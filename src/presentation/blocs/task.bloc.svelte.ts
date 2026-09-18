import type { Task } from '../../domain/models/task.model';
import type { TaskRepository } from '../../domain/repositories/task.repository';

export class TaskBloc {
  tasks = $state<Task[]>([]);
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

  async createTask(newTitle: string) {
    if (!newTitle.trim()) return;

    const created = await this.repository.createTask(newTitle);
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
      this.tasks = this.tasks.filter((t) => t.id !== id);
    } catch (err: any) {
      this.error = err.message;
    }
  }

  async moveTask(id: string, direction: -1 | 1) {
    const fromIndex = this.tasks.findIndex((t) => t.id === id);
    if (fromIndex === -1) return;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= this.tasks.length) return;
    await this.reorder(fromIndex, toIndex);
  }

  async reorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= this.tasks.length) return;
    if (toIndex < 0 || toIndex >= this.tasks.length) return;

    const previous = [...this.tasks];
    const next = [...this.tasks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    this.tasks = next;

    try {
      this.tasks = await this.repository.reorderTasks(next.map((t) => t.id));
    } catch (err: any) {
      this.error = err.message;
      this.tasks = previous;
    }
  }

  async dropTask(dragId: string, overId: string, position: 'before' | 'after') {
    if (dragId === overId) return;
    const previous = [...this.tasks];
    const dragged = previous.find((t) => t.id === dragId);
    const overExists = previous.some((t) => t.id === overId);
    if (!dragged || !overExists) return;

    const withoutDragged = previous.filter((t) => t.id !== dragId);
    const overIndex = withoutDragged.findIndex((t) => t.id === overId);
    const insertIndex = position === 'before' ? overIndex : overIndex + 1;
    withoutDragged.splice(insertIndex, 0, dragged);
    this.tasks = withoutDragged;

    try {
      this.tasks = await this.repository.reorderTasks(withoutDragged.map((t) => t.id));
    } catch (err: any) {
      this.error = err.message;
      this.tasks = previous;
    }
  }
}
