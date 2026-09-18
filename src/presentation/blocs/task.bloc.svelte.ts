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
}
