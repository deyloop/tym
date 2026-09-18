<script lang="ts">
  import { TaskLocalDataSource } from "./data/datasources/task_local.datasource";
  import { TaskRepositoryImpl } from "./data/repositories/task_repository.impl";
  import { TaskBloc } from "./presentation/blocs/task.bloc.svelte";
  import TaskItem from "./presentation/components/TaskItem.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { theme } from "$lib/theme.svelte";
  import { Sun, Moon, Monitor } from "@lucide/svelte";

  // Dependency Injection setup
  const dataSource = new TaskLocalDataSource();
  const repository = new TaskRepositoryImpl(dataSource);
  const bloc = new TaskBloc(repository);

  let newTitle = $state("");
  let dragId = $state<string | null>(null);
  let dropTargetId = $state<string | null>(null);
  let dropPosition = $state<'before' | 'after' | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);

  $effect(() => theme.init());

  function clearDragState() {
    dragId = null;
    dropTargetId = null;
    dropPosition = null;
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    bloc.createTask(newTitle);
    newTitle = "";
  }

  function handleDragStart(id: string) {
    dragId = id;
  }

  function handleDragOver(e: DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    dropPosition = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    dropTargetId = overId;
  }

  async function handleDrop(overId: string) {
    if (!dragId || dragId === overId || !dropTargetId || !dropPosition) {
      clearDragState();
      return;
    }
    const dragged = dragId;
    const position = dropPosition;
    clearDragState();
    await bloc.dropTask(dragged, overId, position);
  }

  function handleDragEnd() {
    clearDragState();
  }

  // Window-level drag handling: catches drops above/below the list
  // (e.g. over the input box) that never land on a task row.
  // Per-item handlers own the indicator while hovering a row; this only
  // infers top/bottom when the pointer is outside the list's vertical span.
  $effect(() => {
    function onWindowDragOver(e: DragEvent) {
      if (!dragId) return;
      e.preventDefault();
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('li[data-task-id]')) return;
      if (!listEl || bloc.tasks.length === 0) return;
      const rect = listEl.getBoundingClientRect();
      if (e.clientY < rect.top) {
        const first = bloc.tasks[0];
        if (first.id !== dragId) {
          dropTargetId = first.id;
          dropPosition = 'before';
        }
      } else if (e.clientY > rect.bottom) {
        const last = bloc.tasks[bloc.tasks.length - 1];
        if (last.id !== dragId) {
          dropTargetId = last.id;
          dropPosition = 'after';
        }
      }
    }

    async function onWindowDrop(e: DragEvent) {
      if (!dragId) return;
      const target = e.target as HTMLElement | null;
      // Dropped on a task row: per-item handler already ran first and cleared state.
      if (target?.closest?.('li[data-task-id]')) return;
      e.preventDefault();
      if (!dropTargetId || !dropPosition) {
        // Dropped in a gap with no indicator: only infer when clearly
        // above/below the list, otherwise cancel.
        if (!listEl || bloc.tasks.length === 0) {
          clearDragState();
          return;
        }
        const rect = listEl.getBoundingClientRect();
        const dragged = dragId;
        clearDragState();
        if (e.clientY < rect.top) {
          const first = bloc.tasks[0];
          if (first && dragged !== first.id) await bloc.dropTask(dragged, first.id, 'before');
        } else if (e.clientY > rect.bottom) {
          const last = bloc.tasks[bloc.tasks.length - 1];
          if (last && dragged !== last.id) await bloc.dropTask(dragged, last.id, 'after');
        }
        return;
      }
      const dragged = dragId;
      const over = dropTargetId;
      const position = dropPosition;
      clearDragState();
      await bloc.dropTask(dragged, over, position);
    }

    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDrop);
    return () => {
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('drop', onWindowDrop);
    };
  });
</script>

<main
  class="min-h-screen bg-background text-foreground flex justify-center p-6 sm:p-12"
>
  <div class="w-full max-w-md space-y-6">
    <header class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-3xl font-bold tracking-tight">Tym</h1>
        <p class="text-sm text-muted-foreground">Local-first Task Management</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onclick={() => theme.cycle()}
        aria-label={`Theme: ${theme.current}, activate to switch to ${theme.next()}`}
        title={`Theme: ${theme.current} (click for ${theme.next()})`}
      >
        {#if theme.current === "light"}
          <Sun />
        {:else if theme.current === "dark"}
          <Moon />
        {:else}
          <Monitor />
        {/if}
      </Button>
    </header>

    <form onsubmit={handleCreate} class="flex gap-2">
      <Input
        type="text"
        placeholder="What needs doing?"
        bind:value={newTitle}
        class="flex-1"
        aria-label="New task title"
      />
      <Button type="submit">Add Task</Button>
    </form>

    <ul bind:this={listEl} class="space-y-2" aria-label="Tasks">
      {#each bloc.tasks as task, i (task.id)}
        {#if dropTargetId === task.id && dropPosition === 'before'}
          <div
            class="h-0.5 rounded-full bg-primary"
            aria-hidden="true"
          ></div>
        {/if}
        <TaskItem
          {task}
          onUpdateTitle={(id, title) => bloc.updateTitle(id, title)}
          onToggle={(id) => bloc.toggleTask(id)}
          onDelete={(id) => bloc.deleteTask(id)}
          onMoveUp={(id) => bloc.moveTask(id, -1)}
          onMoveDown={(id) => bloc.moveTask(id, 1)}
          isFirst={i === 0}
          isLast={i === bloc.tasks.length - 1}
          position={i + 1}
          setSize={bloc.tasks.length}
          isDragging={dragId === task.id}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
        {#if dropTargetId === task.id && dropPosition === 'after'}
          <div
            class="h-0.5 rounded-full bg-primary"
            aria-hidden="true"
          ></div>
        {/if}
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
