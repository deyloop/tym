import type { Task } from '../../domain/models/task.model';

const STORAGE_KEY = 'tym_tasks_v1';

export class TaskLocalDataSource {
  async getTasks(): Promise<Task[]> {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? migrateTasks(JSON.parse(data)) : [];
  }

  async saveTasks(tasks: Task[]): Promise<void>  {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }
}

/**
 * Fills in fields added after a task was first saved. Older tasks only had
 * id/parent/title/completed/createdAt; `completed` maps onto the default
 * CLOSED / PENDING statuses.
 */
function migrateTasks(raw: any[]): Task[] {
  let nextNumber = Math.max(0, ...raw.map((t) => (typeof t.number === 'number' ? t.number : 0))) + 1;
  return raw.map((t) => ({
    id: t.id,
    number: typeof t.number === 'number' ? t.number : nextNumber++,
    parent: t.parent ?? null,
    title: t.title ?? '',
    description: t.description ?? '',
    typeId: t.typeId ?? null,
    statusId: t.statusId ?? (t.completed ? 'closed' : 'pending'),
    reportedBy: t.reportedBy ?? null,
    owner: t.owner ?? null,
    delegatedTo: t.delegatedTo ?? null,
    reportingTo: t.reportingTo ?? null,
    reviewer: t.reviewer ?? null,
    createdAt: t.createdAt ?? Date.now(),
    dueDate: t.dueDate ?? null,
    plannedStart: t.plannedStart ?? null,
    plannedEnd: t.plannedEnd ?? null,
    devCompletionDate: t.devCompletionDate ?? null,
    reviewDate: t.reviewDate ?? null,
    estimateHours: t.estimateHours ?? null,
    spentHours: t.spentHours ?? null,
    history: t.history ?? [{ at: t.createdAt ?? Date.now(), kind: 'created' }],
  }));
}
