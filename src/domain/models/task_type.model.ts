import type { Color } from './color.model';

export interface TaskType {
  id: string;
  name: string;
  color: Color;
}

export const DEFAULT_TASK_TYPES: TaskType[] = [
  { id: 'bug-fix', name: 'Bug Fix', color: 'red' },
  { id: 'ad-hoc', name: 'Ad-Hoc Activity', color: 'amber' },
  { id: 'deliverable', name: 'Deliverable', color: 'blue' },
  { id: 'demonstration', name: 'Demonstration', color: 'purple' },
  { id: 'user-query', name: 'User Query', color: 'teal' },
];
