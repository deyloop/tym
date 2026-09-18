import type { Task } from '../../domain/models/task.model';

const STORAGE_KEY = 'tym_tasks_v1';

export class TaskLocalDataSource {
  async getTasks(): Promise<Task[]> {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  async saveTasks(tasks: Task[]): Promise<void>  {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }
}

