import type { Task, TaskChanges } from '../models/task.model';

export interface NewTask {
  title: string;
  parent: string | null;
  statusId: string;
}

export interface TaskRepository {
  getTasks(): Promise<Task[]>;
  createTask(input: NewTask): Promise<Task>;
  /** Applies the changes and records each changed field in the task's history. */
  updateTask(id: string, changes: TaskChanges): Promise<Task>;
  addNote(id: string, text: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  reorderTasks(orderedIds: string[]): Promise<Task[]>;
}
