import { descendantIds, type Task } from '../../domain/models/task.model';
import type { TaskRepository } from '../../domain/repositories/task.repository';
import type { TaskLocalDataSource } from '../datasources/task_local.datasource';

export class TaskRepositoryImpl implements TaskRepository {
  constructor(private localDataSource: TaskLocalDataSource) {}

  async getTasks(): Promise<Task[]> {
    return this.localDataSource.getTasks();
  }

  async createTask(title: string, parent: string | null = null): Promise<Task> {
    const tasks = await this.localDataSource.getTasks();
    const newTask: Task = {
      id: crypto.randomUUID(),
      parent,
      title: title.trim(),
      completed: false,
      createdAt: Date.now(),
    };
    tasks.push(newTask);
    await this.localDataSource.saveTasks(tasks);
    return newTask;
  }

  async updateTaskTitle(id: string, newTitle: string): Promise<Task> {
    const tasks = await this.localDataSource.getTasks();
    const taskIndex = tasks.findIndex((t) => t.id == id);
    if (taskIndex === -1) throw new Error('Task not found');

    const updatedTask = {...tasks[taskIndex], title: newTitle.trim()};
    tasks[taskIndex] = updatedTask;

    await this.localDataSource.saveTasks(tasks);
    return updatedTask;
  }

  async updateTaskParent(id: string, newParent: string | null): Promise<Task> {
    const tasks = await this.localDataSource.getTasks();
    const taskIndex = tasks.findIndex((t) => t.id == id);
    if (taskIndex === -1) throw new Error('Task not found');

    const updatedTask = {...tasks[taskIndex], parent: newParent};
    tasks[taskIndex] = updatedTask;

    await this.localDataSource.saveTasks(tasks);
    return updatedTask;
  }

  async toggleTaskCompletion(id: string): Promise<Task> {
    const tasks = await this.localDataSource.getTasks();
    const taskIndex = tasks.findIndex((t) => t.id == id);
    if (taskIndex === -1) throw new Error('Task not found');

    tasks[taskIndex].completed = !tasks[taskIndex].completed;

    await this.localDataSource.saveTasks(tasks);
    return tasks[taskIndex];
  }

  async deleteTask(id: string): Promise<void> {
    let tasks = await this.localDataSource.getTasks();
    const removed = new Set([id, ...descendantIds(tasks, id)]);
    tasks = tasks.filter((t) => !removed.has(t.id));
    await this.localDataSource.saveTasks(tasks);
  }

  async reorderTasks(orderedIds: string[]): Promise<Task[]> {
    const tasks = await this.localDataSource.getTasks();
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const reordered: Task[] = [];

    for (const id of orderedIds) {
      const task = byId.get(id);
      if (task) {
        reordered.push(task);
        byId.delete(id);
      }
    }

    // Append any tasks missing from orderedIds (defensive: concurrent creates)
    for (const task of tasks) {
      if (byId.has(task.id)) reordered.push(task);
    }

    await this.localDataSource.saveTasks(reordered);
    return reordered;
  }
}
