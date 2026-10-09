import { DEFAULT_WORKFLOW, type Workflow } from '../../domain/models/workflow.model';
import type { WorkflowRepository } from '../../domain/repositories/workflow.repository';
import type { LocalStorageDataSource } from '../datasources/local_storage.datasource';

export class WorkflowRepositoryImpl implements WorkflowRepository {
  constructor(private dataSource: LocalStorageDataSource<Workflow>) {}

  async getWorkflow(): Promise<Workflow> {
    const workflow = await this.dataSource.load();
    if (workflow) return workflow;
    await this.dataSource.seed(DEFAULT_WORKFLOW);
    return structuredClone(DEFAULT_WORKFLOW);
  }

  async saveWorkflow(workflow: Workflow): Promise<Workflow> {
    await this.dataSource.save(workflow);
    return workflow;
  }
}
