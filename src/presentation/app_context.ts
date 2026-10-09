// Dependency Injection setup: one shared instance of each bloc for every page.
import { LocalStorageDataSource } from '../data/datasources/local_storage.datasource';
import { TaskLocalDataSource } from '../data/datasources/task_local.datasource';
import { LocalCrudRepository } from '../data/repositories/local_crud_repository';
import { TaskRepositoryImpl } from '../data/repositories/task_repository.impl';
import { WorkflowRepositoryImpl } from '../data/repositories/workflow_repository.impl';
import { LocalStore } from '../data/sync/local_store';
import { SyncEngine } from '../data/sync/sync_engine';
import type { Person } from '../domain/models/person.model';
import { DEFAULT_TASK_TYPES, type TaskType } from '../domain/models/task_type.model';
import type { Workflow } from '../domain/models/workflow.model';
import { CrudBloc } from './blocs/crud.bloc.svelte';
import { SyncBloc } from './blocs/sync.bloc.svelte';
import { TaskBloc } from './blocs/task.bloc.svelte';
import { WorkflowBloc } from './blocs/workflow.bloc.svelte';

const store = new LocalStore();

export const workflowBloc = new WorkflowBloc(
  new WorkflowRepositoryImpl(new LocalStorageDataSource<Workflow>(store, 'workflow')),
);

export const taskBloc = new TaskBloc(new TaskRepositoryImpl(new TaskLocalDataSource(store)), workflowBloc);

export const peopleBloc = new CrudBloc<Person>(
  new LocalCrudRepository(new LocalStorageDataSource<Person[]>(store, 'people')),
);

export const taskTypeBloc = new CrudBloc<TaskType>(
  new LocalCrudRepository(new LocalStorageDataSource<TaskType[]>(store, 'taskTypes'), DEFAULT_TASK_TYPES),
);

// Reload whatever another device changed.
const syncEngine = new SyncEngine(store, (changed) => {
  if (changed.has('workflow')) workflowBloc.load();
  if (changed.has('tasks')) taskBloc.loadTasks();
  if (changed.has('people')) peopleBloc.load();
  if (changed.has('taskTypes')) taskTypeBloc.load();
});

export const syncBloc = new SyncBloc(syncEngine);
syncEngine.start();
