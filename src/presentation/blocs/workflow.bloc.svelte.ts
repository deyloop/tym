import {
  allowedTargets,
  canTransition,
  DEFAULT_WORKFLOW,
  type Status,
  type Workflow,
} from '../../domain/models/workflow.model';
import type { WorkflowRepository } from '../../domain/repositories/workflow.repository';

export class WorkflowBloc {
  workflow = $state<Workflow>(structuredClone(DEFAULT_WORKFLOW));
  loaded = $state(false);
  error = $state<string | null>(null);

  statuses = $derived(this.workflow.statuses);
  statusById = $derived(new Map(this.workflow.statuses.map((s) => [s.id, s])));

  constructor(private repository: WorkflowRepository) {
    this.load();
  }

  async load() {
    try {
      this.workflow = await this.repository.getWorkflow();
      this.loaded = true;
    } catch (err: any) {
      this.error = err.message;
    }
  }

  status(id: string): Status | undefined {
    return this.statusById.get(id);
  }

  canTransition(from: string, to: string): boolean {
    return canTransition(this.workflow, from, to);
  }

  allowedTargets(from: string): Status[] {
    return allowedTargets(this.workflow, from);
  }

  async addStatus(name: string, description: string) {
    if (!name.trim()) return;
    const status: Status = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      category: 'in_progress',
      color: 'gray',
    };
    await this.save({ ...this.workflow, statuses: [...this.workflow.statuses, status] });
  }

  async updateStatus(id: string, changes: Partial<Omit<Status, 'id'>>) {
    if (changes.name !== undefined && !changes.name.trim()) return;
    await this.save({
      ...this.workflow,
      statuses: this.workflow.statuses.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    });
  }

  async moveStatus(id: string, direction: -1 | 1) {
    const statuses = [...this.workflow.statuses];
    const from = statuses.findIndex((s) => s.id === id);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= statuses.length) return;
    [statuses[from], statuses[to]] = [statuses[to], statuses[from]];
    await this.save({ ...this.workflow, statuses });
  }

  /** Callers must make sure no task still uses the status. */
  async deleteStatus(id: string) {
    if (id === this.workflow.initialStatusId) {
      this.error = 'Choose a different initial status before deleting this one.';
      return;
    }
    await this.save({
      ...this.workflow,
      statuses: this.workflow.statuses.filter((s) => s.id !== id),
      transitions: this.workflow.transitions.filter((t) => t.from !== id && t.to !== id),
    });
  }

  async setInitialStatus(id: string) {
    await this.save({ ...this.workflow, initialStatusId: id });
  }

  async setTransition(from: string, to: string, allowed: boolean) {
    if (from === to) return;
    const others = this.workflow.transitions.filter((t) => !(t.from === from && t.to === to));
    await this.save({ ...this.workflow, transitions: allowed ? [...others, { from, to }] : others });
  }

  private async save(next: Workflow) {
    const previous = this.workflow;
    this.workflow = next;
    this.error = null;
    try {
      this.workflow = await this.repository.saveWorkflow(next);
    } catch (err: any) {
      this.error = err.message;
      this.workflow = previous;
    }
  }
}
