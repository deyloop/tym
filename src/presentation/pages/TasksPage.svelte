<script lang="ts">
  import type { DropPosition } from "../blocs/task.bloc.svelte";
  import { taskBloc as bloc } from "../app_context";
  import TaskItem from "../components/TaskItem.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";

  let newTitle = $state("");
  let dragId = $state<string | null>(null);
  let dropTargetId = $state<string | null>(null);
  let dropPosition = $state<DropPosition | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);
  let addingSubtaskTo = $state<string | null>(null);
  let subtaskTitle = $state("");
  let subtaskInput = $state<HTMLInputElement | null>(null);

  const roots = $derived(bloc.tree.filter((n) => n.depth === 0));
  // An 'after' drop lands below the target's whole subtree, so draw the line there.
  const indicatorAfterId = $derived(
    dropTargetId && dropPosition === 'after' ? bloc.lastInSubtree(dropTargetId) : null,
  );

  // Focus the subtask input whenever it opens (or moves to another task).
  $effect(() => {
    if (addingSubtaskTo) subtaskInput?.focus();
  });

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

  function openSubtaskForm(parentId: string) {
    addingSubtaskTo = parentId;
    subtaskTitle = "";
  }

  function closeSubtaskForm() {
    addingSubtaskTo = null;
    subtaskTitle = "";
  }

  async function handleCreateSubtask(e: SubmitEvent) {
    e.preventDefault();
    if (!addingSubtaskTo) return;
    // Keep the form open so several subtasks can be added in a row.
    bloc.createTask(subtaskTitle, addingSubtaskTo);
    subtaskTitle = "";
  }

  function handleSubtaskKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeSubtaskForm();
  }

  function handleDragStart(id: string) {
    dragId = id;
  }

  function handleDragOver(e: DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    if (bloc.isDescendant(overId, dragId)) {
      dropTargetId = null;
      dropPosition = null;
      return;
    }
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    let target = overId;
    // Top quarter drops above, bottom quarter below, the middle nests inside.
    const offset = (e.clientY - rect.top) / rect.height;
    let position: DropPosition = offset < 0.25 ? 'before' : offset > 0.75 ? 'after' : 'inside';
    // Just below a task that has subtasks is visually the top of its subtasks.
    const firstChild = position === 'after' ? bloc.childrenOf(overId)[0] : undefined;
    if (firstChild) {
      target = firstChild.id;
      position = 'before';
    }
    if (target === dragId) {
      dropTargetId = null;
      dropPosition = null;
      return;
    }
    dropTargetId = target;
    dropPosition = position;
  }

  async function handleDrop(overId: string) {
    if (!dragId || dragId === overId || !dropTargetId || !dropPosition) {
      clearDragState();
      return;
    }
    const dragged = dragId;
    const target = dropTargetId;
    const position = dropPosition;
    clearDragState();
    await bloc.dropTask(dragged, target, position);
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
      if (!listEl || roots.length === 0) return;
      const rect = listEl.getBoundingClientRect();
      if (e.clientY < rect.top) {
        const first = roots[0].task;
        if (first.id !== dragId) {
          dropTargetId = first.id;
          dropPosition = 'before';
        }
      } else if (e.clientY > rect.bottom) {
        const last = roots[roots.length - 1].task;
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
        if (!listEl || roots.length === 0) {
          clearDragState();
          return;
        }
        const rect = listEl.getBoundingClientRect();
        const dragged = dragId;
        clearDragState();
        if (e.clientY < rect.top) {
          const first = roots[0].task;
          if (dragged !== first.id) await bloc.dropTask(dragged, first.id, 'before');
        } else if (e.clientY > rect.bottom) {
          const last = roots[roots.length - 1].task;
          if (dragged !== last.id) await bloc.dropTask(dragged, last.id, 'after');
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

<div class="space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-bold tracking-tight">Tasks</h1>
    <p class="text-sm text-muted-foreground">
      Drag to reorder; drop onto the middle of a task to nest it. Open a task's details to fill in the rest.
    </p>
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
    {#each bloc.tree as node (node.task.id)}
      {@const task = node.task}
      {@const parentId = bloc.parentOf(task)}
      {#if dropTargetId === task.id && dropPosition === 'before'}
        <div
          class="h-0.5 rounded-full bg-primary"
          style:margin-left="{node.depth * 1.5}rem"
          aria-hidden="true"
        ></div>
      {/if}
      <TaskItem
        {node}
        rollup={bloc.rollups.get(task.id)}
        onAddSubtask={openSubtaskForm}
        parentTitle={parentId ? bloc.tasks.find((t) => t.id === parentId)?.title : undefined}
        isDragging={dragId === task.id}
        isDropTarget={dropTargetId === task.id && dropPosition === 'inside'}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      />
      {#if indicatorAfterId === task.id && dropTargetId}
        {@const targetDepth = bloc.tree.find((n) => n.task.id === dropTargetId)?.depth ?? 0}
        <div
          class="h-0.5 rounded-full bg-primary"
          style:margin-left="{targetDepth * 1.5}rem"
          aria-hidden="true"
        ></div>
      {/if}
      {#if addingSubtaskTo === task.id}
        <li style:margin-left="{(node.depth + 1) * 1.5}rem">
          <form onsubmit={handleCreateSubtask} class="flex gap-2">
            <Input
              type="text"
              placeholder="New subtask"
              bind:value={subtaskTitle}
              onkeydown={handleSubtaskKeydown}
              onblur={() => !subtaskTitle.trim() && closeSubtaskForm()}
              class="flex-1 h-8 text-sm"
              aria-label="New subtask title"
              bind:ref={subtaskInput}
            />
            <Button type="submit" size="sm">Add</Button>
          </form>
        </li>
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
