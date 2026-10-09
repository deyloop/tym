import { descendantIds, type Task, type TaskChanges, type TaskEvent, type TaskField } from '../../domain/models/task.model';
import type { NewTask, TaskRepository } from '../../domain/repositories/task.repository';
import type { TaskLocalDataSource } from '../datasources/task_local.datasource';

export class TaskRepositoryImpl implements TaskRepository {
  constructor(private localDataSource: TaskLocalDataSource) {}

  async getTasks(): Promise<Task[]> {
    return this.localDataSource.getTasks();
  }

  async createTask(input: NewTask): Promise<Task> {
    const tasks = await this.localDataSource.getTasks();
    const now = Date.now();
    const newTask: Task = {
      id: crypto.randomUUID(),
      number: Math.max(0, ...tasks.map((t) => t.number)) + 1,
      parent: input.parent,
      title: input.title.trim(),
      description: '',
      typeId: null,
      statusId: input.statusId,
      reportedBy: null,
      owner: null,
      delegatedTo: null,
      reportingTo: null,
      reviewer: null,
      createdAt: now,
      dueDate: null,
      plannedStart: null,
      plannedEnd: null,
      devCompletionDate: null,
      reviewDate: null,
      estimateHours: null,
      spentHours: null,
      history: [{ at: now, kind: 'created' }],
    };
    tasks.push(newTask);
    await this.localDataSource.saveTasks(tasks);
    return newTask;
  }

  async updateTask(id: string, changes: TaskChanges): Promise<Task> {
    return this.modify(id, (task) => {
      const at = Date.now();
      const events: TaskEvent[] = [];
      for (const [field, value] of Object.entries(changes) as [TaskField, unknown][]) {
        if (task[field] !== value) {
          events.push({ at, kind: 'change', field, from: task[field], to: value });
        }
      }
      return { ...task, ...changes, history: [...task.history, ...events] };
    });
  }

  async addNote(id: string, text: string): Promise<Task> {
    return this.modify(id, (task) => ({
      ...task,
      history: [...task.history, { at: Date.now(), kind: 'note', text: text.trim() }],
    }));
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

  private async modify(id: string, fn: (task: Task) => Task): Promise<Task> {
    const tasks = await this.localDataSource.getTasks();
    const taskIndex = tasks.findIndex((t) => t.id == id);
    if (taskIndex === -1) throw new Error('Task not found');

    const updatedTask = fn(tasks[taskIndex]);
    tasks[taskIndex] = updatedTask;

    await this.localDataSource.saveTasks(tasks);
    return updatedTask;
  }
}
