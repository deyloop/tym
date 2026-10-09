import { descendantIds, type Task, type TaskChanges } from '../../domain/models/task.model';
import type { Status } from '../../domain/models/workflow.model';
import type { TaskRepository } from '../../domain/repositories/task.repository';
import type { WorkflowBloc } from './workflow.bloc.svelte';

/** Where a dragged task lands relative to the task it was dropped on. */
export type DropPosition = 'before' | 'after' | 'inside';

/** A task positioned in the rendered tree (depth-first order). */
export interface TaskNode {
  task: Task;
  depth: number;
  /** 1 for top-level tasks, parent's level + 1 otherwise. */
  level: number;
  /** Task numbers from the root down, e.g. "1-4-7". */
  lineage: string;
  /** 1-based position among its siblings. */
  position: number;
  siblingCount: number;
}

/**
 * Progress for a task's subtree. Leaves contribute their own numbers; a parent
 * is the sum of its children. Cancelled tasks are left out entirely.
 */
export interface Rollup {
  leafCount: number;
  doneCount: number;
  estimate: number;
  spent: number;
  remaining: number;
  /** Estimated hours "earned": a done leaf's full estimate, otherwise time spent capped at the estimate. */
  earned: number;
  /** Share of estimated effort completed, or null without estimates. */
  effortPct: number | null;
  /** Share of leaf tasks done, or null when there are none. */
  countPct: number | null;
}

/** A status change the user may need to pass on to the task's "Reporting to" person. */
export interface StatusChangeNotice {
  taskId: string;
  from: string;
  to: string;
  at: number;
}

export class TaskBloc {
  tasks = $state<Task[]>([]);
  tree = $derived(this.flattenTree(this.tasks));
  nodeById = $derived(new Map(this.tree.map((n) => [n.task.id, n])));
  rollups = $derived(this.computeRollups());
  loading = $state<boolean>(false);
  error = $state<string | null>(null);
  lastStatusChange = $state<StatusChangeNotice | null>(null);

  constructor(
    private repository: TaskRepository,
    private workflow: WorkflowBloc,
  ) {
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

  task(id: string): Task | undefined {
    return this.tasks.find((t) => t.id === id);
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

  isDone(task: Task): boolean {
    return this.workflow.status(task.statusId)?.category === 'done';
  }

  /** Number of tasks matching the predicate, e.g. to check whether a status is still in use. */
  countWhere(predicate: (task: Task) => boolean): number {
    return this.tasks.filter(predicate).length;
  }

  /**
   * The status the checkbox moves a task to: a reachable "done" status when
   * the task is open, or a reachable open status when it is done.
   */
  checkboxTarget(task: Task): Status | undefined {
    const targets = this.workflow.allowedTargets(task.statusId);
    if (this.isDone(task)) {
      return (
        targets.find((s) => s.category === 'in_progress') ?? targets.find((s) => s.category === 'todo')
      );
    }
    return targets.find((s) => s.category === 'done');
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
    const visit = (parent: string | null, depth: number, parentLineage: string) => {
      const siblings = children.get(parent) ?? [];
      siblings.forEach((task, i) => {
        const lineage = parentLineage ? `${parentLineage}-${task.number}` : `${task.number}`;
        nodes.push({ task, depth, level: depth + 1, lineage, position: i + 1, siblingCount: siblings.length });
        visit(task.id, depth + 1, lineage);
      });
    };
    visit(null, 0, '');
    return nodes;
  }

  private computeRollups(): Map<string, Rollup> {
    const result = new Map<string, Rollup>();
    const empty = (): Rollup => ({
      leafCount: 0, doneCount: 0, estimate: 0, spent: 0, remaining: 0, earned: 0, effortPct: null, countPct: null,
    });

    // Children always come after their parent in tree order, so walk it backwards.
    for (let i = this.tree.length - 1; i >= 0; i--) {
      const { task } = this.tree[i];
      const category = this.workflow.status(task.statusId)?.category;
      const children = this.childrenOf(task.id);
      let r = empty();

      if (category === 'cancelled') {
        // Contributes nothing.
      } else if (children.length === 0) {
        const done = category === 'done';
        const estimate = task.estimateHours ?? 0;
        const spent = task.spentHours ?? 0;
        r = {
          ...r,
          leafCount: 1,
          doneCount: done ? 1 : 0,
          estimate,
          spent,
          remaining: done ? 0 : Math.max(estimate - spent, 0),
          earned: done ? estimate : Math.min(spent, estimate),
        };
      } else {
        for (const child of children) {
          const c = result.get(child.id)!;
          r.leafCount += c.leafCount;
          r.doneCount += c.doneCount;
          r.estimate += c.estimate;
          r.spent += c.spent;
          r.remaining += c.remaining;
          r.earned += c.earned;
        }
      }
      r.effortPct = r.estimate > 0 ? r.earned / r.estimate : null;
      r.countPct = r.leafCount > 0 ? r.doneCount / r.leafCount : null;
      result.set(task.id, r);
    }
    return result;
  }

  async createTask(newTitle: string, parent: string | null = null) {
    if (!newTitle.trim()) return;

    try {
      const created = await this.repository.createTask({
        title: newTitle,
        parent,
        statusId: this.workflow.workflow.initialStatusId,
      });
      this.tasks.push(created);
    } catch (err: any) {
      this.error = err.message;
    }
  }

  async updateTask(id: string, changes: TaskChanges) {
    if (changes.title !== undefined && !changes.title.trim()) return;
    if (changes.statusId !== undefined) {
      const current = this.task(id);
      if (current && !this.workflow.canTransition(current.statusId, changes.statusId)) {
        const from = this.workflow.status(current.statusId)?.name ?? '?';
        const to = this.workflow.status(changes.statusId)?.name ?? '?';
        this.error = `The workflow doesn't allow moving from ${from} to ${to}.`;
        return;
      }
    }

    try {
      const before = this.task(id);
      const updated = await this.repository.updateTask(id, changes);
      this.tasks = this.tasks.map((t) => (t.id === id ? updated : t));
      if (before && before.statusId !== updated.statusId) {
        this.lastStatusChange = { taskId: id, from: before.statusId, to: updated.statusId, at: Date.now() };
      }
    } catch (err: any) {
      this.error = err.message;
    }
  }

  async updateTitle(id: string, newTitle: string) {
    await this.updateTask(id, { title: newTitle.trim() });
  }

  async toggleDone(id: string) {
    const task = this.task(id);
    if (!task) return;
    const target = this.checkboxTarget(task);
    if (target) await this.updateTask(id, { statusId: target.id });
  }

  async addNote(id: string, text: string) {
    if (!text.trim()) return;
    try {
      const updated = await this.repository.addNote(id, text);
      this.tasks = this.tasks.map((t) => (t.id === id ? updated : t));
    } catch (err: any) {
      this.error = err.message;
    }
  }

  /** Clears every reference to a removed person or task type. */
  async clearReferences(fields: (keyof TaskChanges)[], value: string) {
    for (const task of this.tasks) {
      const changes: TaskChanges = {};
      for (const field of fields) {
        if (task[field] === value) (changes as Record<string, null>)[field] = null;
      }
      if (Object.keys(changes).length > 0) await this.updateTask(task.id, changes);
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

    const withoutDragged = previous.filter((t) => t.id !== dragId);
    if (position === 'inside') {
      // Siblings are ordered by list position, so appending makes it the last subtask.
      withoutDragged.push(dragged);
    } else {
      const overIndex = withoutDragged.findIndex((t) => t.id === overId);
      const insertIndex = position === 'before' ? overIndex : overIndex + 1;
      withoutDragged.splice(insertIndex, 0, dragged);
    }
    this.tasks = withoutDragged.map((t) => (t.id === dragId ? { ...t, parent: newParent } : t));

    try {
      if (dragged.parent !== newParent) {
        await this.repository.updateTask(dragId, { parent: newParent });
      }
      this.tasks = await this.repository.reorderTasks(withoutDragged.map((t) => t.id));
    } catch (err: any) {
      this.error = err.message;
      this.tasks = previous;
    }
  }
}
