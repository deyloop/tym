/** A calendar date as YYYY-MM-DD, or null when unset. */
export type DateString = string | null;

export interface TaskEvent {
  at: number;
  kind: 'created' | 'change' | 'note';
  /** For 'change': which task field changed. */
  field?: TaskField;
  from?: unknown;
  to?: unknown;
  /** For 'note': free text. */
  text?: string;
}

export interface Task {
  id: string;
  /** Human-friendly sequential id, used to build the lineage (e.g. 1-4-7). */
  number: number;
  parent: string | null;
  title: string;
  description: string;
  typeId: string | null;
  statusId: string;

  reportedBy: string | null;
  owner: string | null;
  delegatedTo: string | null;
  reportingTo: string | null;
  reviewer: string | null;

  createdAt: number;
  dueDate: DateString;
  plannedStart: DateString;
  plannedEnd: DateString;
  devCompletionDate: DateString;
  reviewDate: DateString;

  estimateHours: number | null;
  spentHours: number | null;

  history: TaskEvent[];
}

/** Fields that can be edited after creation (and are recorded in the history). */
export type TaskField = Exclude<keyof Task, 'id' | 'number' | 'createdAt' | 'history'>;
export type TaskChanges = Partial<Pick<Task, TaskField>>;

export const PERSON_FIELDS = ['reportedBy', 'owner', 'delegatedTo', 'reportingTo', 'reviewer'] as const;
export type PersonField = (typeof PERSON_FIELDS)[number];

export const DATE_FIELDS = ['dueDate', 'plannedStart', 'plannedEnd', 'devCompletionDate', 'reviewDate'] as const;
export type DateField = (typeof DATE_FIELDS)[number];

export const FIELD_LABELS: Record<TaskField, string> = {
  parent: 'Parent',
  title: 'Title',
  description: 'Description',
  typeId: 'Type',
  statusId: 'Status',
  reportedBy: 'Reported by',
  owner: 'Owner',
  delegatedTo: 'Delegated to',
  reportingTo: 'Reporting to',
  reviewer: 'Reviewer',
  dueDate: 'Due date',
  plannedStart: 'Planned start',
  plannedEnd: 'Planned end',
  devCompletionDate: 'Dev completion',
  reviewDate: 'Review date',
  estimateHours: 'Estimate (h)',
  spentHours: 'Spent (h)',
};

/** Ids of every task nested (at any depth) under the task with the given id. */
export function descendantIds(tasks: Task[], id: string): string[] {
  const result: string[] = [];
  const queue = [id];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of tasks) {
      if (t.parent === current && !seen.has(t.id)) {
        seen.add(t.id);
        result.push(t.id);
        queue.push(t.id);
      }
    }
  }
  return result;
}
