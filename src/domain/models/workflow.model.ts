import type { Color } from './color.model';

/**
 * How a status counts towards progress:
 * - todo / in_progress: open work
 * - done: finished, counts as complete
 * - cancelled: dropped, excluded from progress and effort rollups
 */
export type StatusCategory = 'todo' | 'in_progress' | 'done' | 'cancelled';

export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export interface Status {
  id: string;
  name: string;
  description: string;
  category: StatusCategory;
  color: Color;
}

export interface Transition {
  from: string;
  to: string;
}

/** The task state machine: the available statuses and the moves allowed between them. */
export interface Workflow {
  statuses: Status[];
  transitions: Transition[];
  /** Status given to newly created tasks. */
  initialStatusId: string;
}

export function canTransition(workflow: Workflow, from: string, to: string): boolean {
  if (from === to) return true;
  return workflow.transitions.some((t) => t.from === from && t.to === to);
}

export function allowedTargets(workflow: Workflow, from: string): Status[] {
  return workflow.statuses.filter((s) => s.id !== from && canTransition(workflow, from, s.id));
}

export const DEFAULT_WORKFLOW: Workflow = {
  statuses: [
    { id: 'pending', name: 'PENDING', description: 'Logged but not started yet.', category: 'todo', color: 'gray' },
    { id: 'ongoing', name: 'ONGOING', description: 'Actively being worked on.', category: 'in_progress', color: 'blue' },
    { id: 'blocked', name: 'BLOCKED', description: 'Cannot progress until something outside the task is resolved.', category: 'in_progress', color: 'red' },
    { id: 'in-review', name: 'IN REVIEW', description: 'Development is complete and the work is awaiting review.', category: 'in_progress', color: 'purple' },
    { id: 'closed', name: 'CLOSED', description: 'Finished and accepted.', category: 'done', color: 'green' },
    { id: 'cancelled', name: 'CANCELLED', description: 'Dropped; no further work will be done.', category: 'cancelled', color: 'gray' },
  ],
  transitions: [
    { from: 'pending', to: 'ongoing' },
    { from: 'pending', to: 'cancelled' },
    { from: 'ongoing', to: 'blocked' },
    { from: 'ongoing', to: 'in-review' },
    { from: 'ongoing', to: 'closed' },
    { from: 'ongoing', to: 'cancelled' },
    { from: 'blocked', to: 'ongoing' },
    { from: 'blocked', to: 'cancelled' },
    { from: 'in-review', to: 'ongoing' },
    { from: 'in-review', to: 'closed' },
    { from: 'closed', to: 'ongoing' },
    { from: 'cancelled', to: 'pending' },
  ],
  initialStatusId: 'pending',
};
