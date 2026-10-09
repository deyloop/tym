import { descendantIds, type Task } from '../../domain/models/task.model';
import type { TaskRepository } from '../../domain/repositories/task.repository';

/** A task positioned in the rendered tree (depth-first order). */
/** Where a dragged task lands relative to the task it was dropped on. */
export type DropPosition = 'before' | 'after' | 'inside';

export interface TaskNode {
  task: Task;
  depth: number;
  /** 1-based position among its siblings. */
  position: number;
  siblingCount: number;
}

export class TaskBloc {
  tasks = $state<Task[]>([]);
  tree = $derived(this.flattenTree(this.tasks));
  loading = $state<boolean>(false);
  error = $state<string | null>(null);

  constructor(private repository: TaskRepository){
    this.loadTasks();
  }

  async loadTasks() {
    this.loading = true;
    try {
      this.tasks = await this.repository.getTasks();
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  /** Parent id used for display; tasks whose parent no longer exists are treated as roots. */
  parentOf(task: Task): string | null {
    return task.parent && this.tasks.some((t) => t.id === task.parent) ? task.parent : null;
  }

  childrenOf(parent: string | null): Task[] {
    return this.tasks.filter((t) => this.parentOf(t) === parent);
  }

  isDescendant(id: string, ancestorId: string): boolean {
    return descendantIds(this.tasks, ancestorId).includes(id);
  }

  /** Id of the last row (in tree order) belonging to the subtree rooted at id. */
  lastInSubtree(id: string): string {
    const start = this.tree.findIndex((n) => n.task.id === id);
    if (start === -1) return id;
    let end = start;
    while (end + 1 < this.tree.length && this.tree[end + 1].depth > this.tree[start].depth) end++;
    return this.tree[end].task.id;
  }

  private flattenTree(tasks: Task[]): TaskNode[] {
    const ids = new Set(tasks.map((t) => t.id));
    const children = new Map<string | null, Task[]>();
    for (const t of tasks) {
      const key = t.parent && ids.has(t.parent) ? t.parent : null;
      if (!children.has(key)) children.set(key, []);
      children.get(key)!.push(t);
    }

    const nodes: TaskNode[] = [];
    const visit = (parent: string | null, depth: number) => {
      const siblings = children.get(parent) ?? [];
      siblings.forEach((task, i) => {
        nodes.push({ task, depth, position: i + 1, siblingCount: siblings.length });
        visit(task.id, depth + 1);
      });
    };
    visit(null, 0);
    return nodes;
  }

  async createTask(newTitle: string, parent: string | null = null) {
    if (!newTitle.trim()) return;

    const created = await this.repository.createTask(newTitle, parent);
    this.tasks.push(created);
  }

  async updateTitle(id: string, newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    try {
      const updated = await this.repository.updateTaskTitle(id, trimmed);
      this.tasks = this.tasks.map((t) => (t.id === id ? updated : t));
    } catch (err: any) {
      this.error = err.message;
    }
  }

  async toggleTask(id: string) {
    try {
      console.log("Pre ",this.tasks)
      const updated = await this.repository.toggleTaskCompletion(id);
      this.tasks = this.tasks.map((t) => (t.id === id ? updated : t));
      console.log(this.tasks)
    } catch (err: any) {
      this.error = err.message;
    }
  }

  async deleteTask(id: string) {
    try {
      await this.repository.deleteTask(id);
      const removed = new Set([id, ...descendantIds(this.tasks, id)]);
      this.tasks = this.tasks.filter((t) => !removed.has(t.id));
    } catch (err: any) {
      this.error = err.message;
    }
  }

  async moveTask(id: string, direction: -1 | 1) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    const siblings = this.childrenOf(this.parentOf(task));
    const neighbor = siblings[siblings.findIndex((t) => t.id === id) + direction];
    if (!neighbor) return;
    await this.dropTask(id, neighbor.id, direction === -1 ? 'before' : 'after');
  }

  async dropTask(dragId: string, overId: string, position: DropPosition) {
    if (dragId === overId) return;
    const previous = [...this.tasks];
    const dragged = previous.find((t) => t.id === dragId);
    const over = previous.find((t) => t.id === overId);
    if (!dragged || !over) return;
    // A task can't be moved inside its own subtree.
    if (this.isDescendant(overId, dragId)) return;

    // Dropping onto a task nests the dragged task under it; dropping beside it makes them siblings.
    const newParent = position === 'inside' ? overId : this.parentOf(over);
    const moved = { ...dragged, parent: newParent };

    const withoutDragged = previous.filter((t) => t.id !== dragId);
    if (position === 'inside') {
      // Siblings are ordered by list position, so appending makes it the last subtask.
      withoutDragged.push(moved);
    } else {
      const overIndex = withoutDragged.findIndex((t) => t.id === overId);
      const insertIndex = position === 'before' ? overIndex : overIndex + 1;
      withoutDragged.splice(insertIndex, 0, moved);
    }
    this.tasks = withoutDragged;

    try {
      if (dragged.parent !== newParent) {
        await this.repository.updateTaskParent(dragId, newParent);
      }
      this.tasks = await this.repository.reorderTasks(withoutDragged.map((t) => t.id));
    } catch (err: any) {
      this.error = err.message;
      this.tasks = previous;
    }
  }
}
