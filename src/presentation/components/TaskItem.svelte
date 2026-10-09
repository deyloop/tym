<script lang="ts">
  import type { Rollup, TaskNode } from "../blocs/task.bloc.svelte";
  import { peopleBloc, taskBloc, taskTypeBloc } from "../app_context";
  import { formatDate, formatPct, todayString } from "../styles";
  import Badge from "./Badge.svelte";
  import StatusSelect from "./StatusSelect.svelte";

  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";

  import {
    ListPlus,
    Pencil,
    X,
    ChevronUp,
    ChevronDown,
    GripVertical,
    PanelRightOpen,
    User,
    Calendar,
  } from "@lucide/svelte";

  interface Props {
    node: TaskNode;
    rollup: Rollup | undefined;
    parentTitle?: string;
    onAddSubtask: (id: string) => void;
    isDragging: boolean;
    isDropTarget: boolean;
    onDragStart: (id: string) => void;
    onDragOver: (e: DragEvent, id: string) => void;
    onDrop: (id: string) => void;
    onDragEnd: () => void;
  }

  let {
    node,
    rollup,
    parentTitle,
    onAddSubtask,
    isDragging,
    isDropTarget,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  }: Props = $props();

  const task = $derived(node.task);
  const isFirst = $derived(node.position === 1);
  const isLast = $derived(node.position === node.siblingCount);
  const done = $derived(taskBloc.isDone(task));
  const checkboxTarget = $derived(taskBloc.checkboxTarget(task));
  const type = $derived(task.typeId ? taskTypeBloc.byId.get(task.typeId) : undefined);
  const owner = $derived(peopleBloc.nameOf(task.owner));
  const overdue = $derived(!done && !!task.dueDate && task.dueDate < todayString());
  const hasSubtasks = $derived(taskBloc.childrenOf(task.id).length > 0);

  let isEditing = $state(false);
  let editInput = $derived(task.title);

  function saveEdit() {
    if (isEditing) {
      taskBloc.updateTitle(task.id, editInput);
      isEditing = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") {
      editInput = task.title;
      isEditing = false;
    }
  }

  function handleItemKeydown(e: KeyboardEvent) {
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      taskBloc.moveTask(task.id, -1);
    } else if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      taskBloc.moveTask(task.id, 1);
    } else if (!isEditing && e.key === "Enter" && e.target === e.currentTarget) {
      isEditing = true;
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<li
  data-task-id={task.id}
  draggable="true"
  ondragstart={() => onDragStart(task.id)}
  ondragover={(e) => onDragOver(e, task.id)}
  ondrop={() => onDrop(task.id)}
  ondragend={onDragEnd}
  onkeydown={handleItemKeydown}
  aria-posinset={node.position}
  aria-setsize={node.siblingCount}
  aria-label="{node.position} of {node.siblingCount}: {task.title}{parentTitle
    ? `, subtask of ${parentTitle}`
    : ''}"
  style:margin-left="{node.depth * 1.5}rem"
  class="flex items-start gap-2 p-3 bg-card border border-border rounded-lg shadow-sm transition-all hover:border-border/80 {isDragging
    ? 'opacity-50'
    : ''} {isDropTarget ? 'ring-2 ring-primary' : ''}"
>
  <span
    class="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground touch-none"
    title="Drag to reorder"
    aria-hidden="true"
  >
    <GripVertical class="size-4" />
  </span>

  <Checkbox
    class="mt-0.5"
    checked={done}
    disabled={!checkboxTarget}
    title={checkboxTarget
      ? `Move to ${checkboxTarget.name}`
      : "The workflow has no transition for this from the current status"}
    aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
    onCheckedChange={() => taskBloc.toggleDone(task.id)}
  />

  <div class="flex-1 min-w-0 space-y-1.5">
    {#if isEditing}
      <Input
        type="text"
        bind:value={editInput}
        onblur={saveEdit}
        onkeydown={handleKeydown}
        class="h-8 text-sm"
        autofocus
        aria-label="Task title"
      />
    {:else}
      <span
        role="button"
        tabindex="0"
        ondblclick={() => (isEditing = true)}
        onkeydown={(e) => e.key === "Enter" && (isEditing = true)}
        class="block text-sm font-medium cursor-pointer select-none text-left break-words {done
          ? 'line-through text-muted-foreground'
          : 'text-foreground'}"
      >
        {task.title}
      </span>
    {/if}

    <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
      <span class="font-mono" title="Lineage (level {node.level})">#{node.lineage}</span>
      <StatusSelect {task} />
      {#if type}
        <Badge color={type.color}>{type.name}</Badge>
      {/if}
      {#if owner}
        <span class="inline-flex items-center gap-1" title="Owner"><User class="size-3" />{owner}</span>
      {/if}
      {#if task.dueDate}
        <span
          class="inline-flex items-center gap-1 {overdue ? 'text-destructive font-medium' : ''}"
          title={overdue ? "Overdue" : "Due date"}
        >
          <Calendar class="size-3" />{formatDate(task.dueDate)}
        </span>
      {/if}
      {#if hasSubtasks && rollup && rollup.leafCount > 0}
        <span
          title="Subtasks done: {rollup.doneCount} of {rollup.leafCount} · Effort complete: {formatPct(
            rollup.effortPct,
          )}"
        >
          {rollup.doneCount}/{rollup.leafCount} done{rollup.effortPct !== null
            ? ` · ${formatPct(rollup.effortPct)} effort`
            : ""}
        </span>
      {/if}
    </div>
  </div>

  <div class="flex flex-wrap justify-end items-center gap-1">
    <Button
      aria-label="Move {task.title} up"
      title="Move up (Alt+Up)"
      variant="ghost"
      size="sm"
      class="hidden sm:inline-flex h-8 w-8 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
      disabled={isFirst}
      onclick={() => taskBloc.moveTask(task.id, -1)}
    >
      <ChevronUp />
    </Button>
    <Button
      aria-label="Move {task.title} down"
      title="Move down (Alt+Down)"
      variant="ghost"
      size="sm"
      class="hidden sm:inline-flex h-8 w-8 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
      disabled={isLast}
      onclick={() => taskBloc.moveTask(task.id, 1)}
    >
      <ChevronDown />
    </Button>
    {#if !isEditing}
      <Button
        aria-label="Edit {task.title}"
        title="Edit title"
        variant="ghost"
        size="sm"
        class="hidden sm:inline-flex h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        onclick={() => (isEditing = true)}
      >
        <Pencil />
      </Button>
    {/if}
    <Button
      aria-label="Add subtask to {task.title}"
      title="Add Subtask"
      variant="ghost"
      size="sm"
      class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
      onclick={() => onAddSubtask(task.id)}
    >
      <ListPlus />
    </Button>
    <Button
      aria-label="Open details for {task.title}"
      title="Details"
      variant="ghost"
      size="sm"
      class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
      href="#/tasks/{task.id}"
    >
      <PanelRightOpen />
    </Button>
    <Button
      aria-label="Delete {task.title}"
      title="Delete"
      variant="ghost"
      size="sm"
      class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      onclick={() => {
        if (hasSubtasks && !confirm(`Delete "${task.title}" and all of its subtasks?`)) return;
        taskBloc.deleteTask(task.id);
      }}
    >
      <X />
    </Button>
  </div>
</li>
