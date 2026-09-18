import type { Task } from '../models/task.model';

export interface TaskRepository {
  getTasks(): Promise<Task[]>;
  createTask(title: string): Promise<Task>;
  updateTaskTitle(id: string, newTitle: string): Promise<Task>;
  updateTaskParent(id: string, newParent: string | null): Promise<Task>;
  toggleTaskCompletion(id: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  reorderTasks(orderedIds: string[]): Promise<Task[]>;
}

