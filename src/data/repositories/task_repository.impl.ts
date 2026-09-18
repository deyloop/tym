import type { Task } from '../../domain/models/task.model';
import type { TaskRepository } from '../../domain/repositories/task.repository';
import type { TaskLocalDataSource } from '../datasources/task_local.datasource';

export class TaskRepositoryImpl implements TaskRepository {
  constructor(private localDataSource: TaskLocalDataSource) {}

  async getTasks(): Promise<Task[]> {
    return this.localDataSource.getTasks();
  }

  async createTask(title: string): Promise<Task> {
    const tasks = await this.localDataSource.getTasks();
    const newTask: Task = {
      id: crypto.randomUUID(),
      parent: null,
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

  async updateTaskParent(id: string, newParent: string): Promise<Task> {
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
    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    let tasks = await this.localDataSource.getTasks();
    tasks = tasks.filter((t) => t.id !== id);
    await this.localDataSource.saveTasks(tasks);
  }
}
