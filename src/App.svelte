<script lang="ts">
  import { TaskLocalDataSource } from "./data/datasources/task_local.datasource";
  import { TaskRepositoryImpl } from "./data/repositories/task_repository.impl";
  import { TaskBloc } from "./presentation/blocs/task.bloc.svelte";
  import TaskItem from "./presentation/components/TaskItem.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";

  // Dependency Injection setup
  const dataSource = new TaskLocalDataSource();
  const repository = new TaskRepositoryImpl(dataSource);
  const bloc = new TaskBloc(repository);

  let newTitle = $state("");

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    bloc.createTask(newTitle);
    newTitle = "";
  }
</script>

<main
  class="min-h-screen bg-background text-foreground flex justify-center p-6 sm:p-12"
>
  <div class="w-full max-w-md space-y-6">
    <header class="space-y-1">
      <h1 class="text-3xl font-bold tracking-tight">Tym</h1>
      <p class="text-sm text-muted-foreground">Local-first Task Management</p>
    </header>

    <form onsubmit={handleCreate} class="flex gap-2">
      <Input
        type="text"
        placeholder="What needs doing?"
        bind:value={newTitle}
        class="flex-1"
      />
      <Button type="submit">Add Task</Button>
    </form>

    <ul class="space-y-2">
      {#each bloc.tasks as task (task.id)}
        <TaskItem
          {task}
          onUpdateTitle={(id, title) => bloc.updateTitle(id, title)}
          onToggle={(id) => bloc.toggleTask(id)}
          onDelete={(id) => bloc.deleteTask(id)}
        />
      {:else}
        <li
          class="p-8 text-center border border-dashed rounded-lg text-sm text-muted-foreground"
        >
          No tasks found. Create one above!
        </li>
      {/each}
    </ul>
  </div>
</main>
