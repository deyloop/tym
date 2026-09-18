<script lang="ts">
  import type { Task } from "../../domain/models/task.model";

  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";

  import { ListPlus, Pencil, X, Play } from "@lucide/svelte";

  interface Props {
    task: Task;
    onUpdateTitle: (id: string, title: string) => void;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
  }

  let { task, onUpdateTitle, onToggle, onDelete }: Props = $props();

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
</script>

<li
  class="flex items-center gap-3 p-3 bg-card border border-border rounded-lg shadow-sm transition-all hover:border-border/80"
>
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
      aria-label="Start Task: {task.title}"
      title="Start"
      variant="ghost"
      size="sm"
      class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
    >
      <Play />
    </Button>
    <Button
      aria-label="Add subtask to {task.title}"
      title="Add Subtask"
      variant="ghost"
      size="sm"
      class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
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
