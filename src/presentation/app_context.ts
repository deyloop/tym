// Dependency Injection setup: one shared instance of each bloc for every page.
import { LocalStorageDataSource } from '../data/datasources/local_storage.datasource';
import { TaskLocalDataSource } from '../data/datasources/task_local.datasource';
import { LocalCrudRepository } from '../data/repositories/local_crud_repository';
import { TaskRepositoryImpl } from '../data/repositories/task_repository.impl';
import { WorkflowRepositoryImpl } from '../data/repositories/workflow_repository.impl';
import type { Person } from '../domain/models/person.model';
import { DEFAULT_TASK_TYPES, type TaskType } from '../domain/models/task_type.model';
import type { Workflow } from '../domain/models/workflow.model';
import { CrudBloc } from './blocs/crud.bloc.svelte';
import { TaskBloc } from './blocs/task.bloc.svelte';
import { WorkflowBloc } from './blocs/workflow.bloc.svelte';

export const workflowBloc = new WorkflowBloc(
  new WorkflowRepositoryImpl(new LocalStorageDataSource<Workflow>('tym_workflow_v1')),
);

export const taskBloc = new TaskBloc(new TaskRepositoryImpl(new TaskLocalDataSource()), workflowBloc);

export const peopleBloc = new CrudBloc<Person>(
  new LocalCrudRepository(new LocalStorageDataSource<Person[]>('tym_people_v1')),
);

export const taskTypeBloc = new CrudBloc<TaskType>(
  new LocalCrudRepository(new LocalStorageDataSource<TaskType[]>('tym_task_types_v1'), DEFAULT_TASK_TYPES),
);
