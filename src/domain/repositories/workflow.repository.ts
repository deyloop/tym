import type { Workflow } from '../models/workflow.model';

export interface WorkflowRepository {
  getWorkflow(): Promise<Workflow>;
  saveWorkflow(workflow: Workflow): Promise<Workflow>;
}
