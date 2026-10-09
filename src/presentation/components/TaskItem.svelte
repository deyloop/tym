<script lang="ts">
  import type { Task } from "../../domain/models/task.model";

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
  } from "@lucide/svelte";

  interface Props {
    task: Task;
    onUpdateTitle: (id: string, title: string) => void;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onAddSubtask: (id: string) => void;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
    isFirst: boolean;
    isLast: boolean;
    position: number;
    setSize: number;
    depth: number;
    parentTitle?: string;
    isDragging: boolean;
    isDropTarget: boolean;
    onDragStart: (id: string) => void;
    onDragOver: (e: DragEvent, id: string) => void;
    onDrop: (id: string) => void;
    onDragEnd: () => void;
  }

  let {
    task,
    onUpdateTitle,
    onToggle,
    onDelete,
    onAddSubtask,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
    position,
    setSize,
    depth,
    parentTitle,
    isDragging,
    isDropTarget,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  }: Props = $props();

  let isEditing = $state(false);
  let editInput = $derived(task.title);

  function saveEdit() {
    if (isEditing) {
      onUpdateTitle(task.id, editInput);
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
      onMoveUp(task.id);
    } else if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      onMoveDown(task.id);
    } else if (!isEditing && e.key === "Enter") {
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
  aria-posinset={position}
  aria-setsize={setSize}
  aria-label="{position} of {setSize}: {task.title}{parentTitle
    ? `, subtask of ${parentTitle}`
    : ''}"
  style:margin-left="{depth * 1.5}rem"
  class="flex items-center gap-2 p-3 bg-card border border-border rounded-lg shadow-sm transition-all hover:border-border/80 {isDragging
    ? 'opacity-50'
    : ''} {isDropTarget ? 'ring-2 ring-primary' : ''}"
>
  <span
    class="cursor-grab text-muted-foreground hover:text-foreground touch-none"
    title="Drag to reorder"
    aria-hidden="true"
  >
    <GripVertical class="size-4" />
  </span>

  <Checkbox
    checked={task.completed}
    onCheckedChange={() => onToggle(task.id)}
  />

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
      class="flex-1 text-sm font-medium cursor-pointer select-none text-left {task.completed
        ? 'line-through text-muted-foreground'
        : 'text-foreground'}"
    >
      {task.title}
    </span>
  {/if}

  <div class="flex items-center gap-1">
    <Button
      aria-label="Move {task.title} up"
      title="Move up (Alt+Up)"
      variant="ghost"
      size="sm"
      class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
      disabled={isFirst}
      onclick={() => onMoveUp(task.id)}
    >
      <ChevronUp />
    </Button>
    <Button
      aria-label="Move {task.title} down"
      title="Move down (Alt+Down)"
      variant="ghost"
      size="sm"
      class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
      disabled={isLast}
      onclick={() => onMoveDown(task.id)}
    >
      <ChevronDown />
    </Button>
    {#if !isEditing}
      <Button
        aria-label="Edit {task.title}"
        title="Edit"
        variant="ghost"
        size="sm"
        class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
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
      aria-label="Delete {task.title}"
      title="Delete"
      variant="ghost"
      size="sm"
      class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      onclick={() => onDelete(task.id)}
    >
      <X />
    </Button>
  </div>
</li>
