<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Trash2 } from "@lucide/svelte";
  import type { Color } from "../../domain/models/color.model";
  import { taskBloc, taskTypeBloc } from "../app_context";
  import Badge from "../components/Badge.svelte";
  import ColorPicker from "../components/ColorPicker.svelte";

  let name = $state("");
  let color = $state<Color>("gray");

  function usage(id: string): number {
    return taskBloc.countWhere((t) => t.typeId === id);
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    await taskTypeBloc.create({ name, color });
    name = "";
  }

  async function handleDelete(id: string, typeName: string) {
    const used = usage(id);
    if (used > 0) {
      if (!confirm(`${used} task(s) use "${typeName}". Delete anyway and clear their type?`)) return;
      await taskBloc.clearReferences(["typeId"], id);
    }
    await taskTypeBloc.delete(id);
  }
</script>

<div class="space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-bold tracking-tight">Task Types</h1>
    <p class="text-sm text-muted-foreground">Categories such as Bug Fix or Deliverable, shown as a colored tag on each task.</p>
  </header>

  <form onsubmit={handleCreate} class="flex flex-col sm:flex-row sm:items-center gap-2">
    <Input bind:value={name} placeholder="Type name" aria-label="New type name" class="flex-1" />
    <ColorPicker bind:value={color} label="Color for the new type" />
    <Button type="submit">Add Type</Button>
  </form>

  <ul class="space-y-2" aria-label="Task types">
    {#each taskTypeBloc.items as type (type.id)}
      {@const used = usage(type.id)}
      <li class="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-card border border-border rounded-lg shadow-sm">
        <div class="w-36 shrink-0"><Badge color={type.color}>{type.name}</Badge></div>
        <Input
          value={type.name}
          aria-label="Name"
          class="h-8 text-sm flex-1"
          onchange={(e) => taskTypeBloc.update(type.id, { name: e.currentTarget.value })}
        />
        <ColorPicker
          value={type.color}
          label="Color for {type.name}"
          onchange={(c) => taskTypeBloc.update(type.id, { color: c })}
        />
        <div class="flex items-center justify-between sm:justify-end gap-2">
          <span class="text-xs text-muted-foreground whitespace-nowrap">{used} task{used === 1 ? "" : "s"}</span>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            aria-label="Delete {type.name}"
            title="Delete"
            onclick={() => handleDelete(type.id, type.name)}
          >
            <Trash2 />
          </Button>
        </div>
      </li>
    {:else}
      <li class="p-8 text-center border border-dashed rounded-lg text-sm text-muted-foreground">
        No task types. Add one above.
      </li>
    {/each}
  </ul>
</div>
