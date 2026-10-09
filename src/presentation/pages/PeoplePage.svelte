<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Trash2 } from "@lucide/svelte";
  import { PERSON_FIELDS } from "../../domain/models/task.model";
  import { peopleBloc, taskBloc } from "../app_context";

  let name = $state("");
  let note = $state("");

  function usage(id: string): number {
    return taskBloc.countWhere((t) => PERSON_FIELDS.some((f) => t[f] === id));
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    await peopleBloc.create({ name, note: note.trim() });
    name = "";
    note = "";
  }

  async function handleDelete(id: string, personName: string) {
    const used = usage(id);
    if (used > 0) {
      if (!confirm(`${personName} is referenced by ${used} task(s). Delete anyway and clear those references?`)) return;
      await taskBloc.clearReferences([...PERSON_FIELDS], id);
    }
    await peopleBloc.delete(id);
  }
</script>

<div class="space-y-6">
  <header class="space-y-1">
    <h1 class="text-2xl font-bold tracking-tight">People</h1>
    <p class="text-sm text-muted-foreground">
      People who report, own, get delegated, review, or receive updates about tasks.
    </p>
  </header>

  <form onsubmit={handleCreate} class="flex flex-col sm:flex-row gap-2">
    <Input bind:value={name} placeholder="Name" aria-label="New person's name" class="sm:w-56" />
    <Input bind:value={note} placeholder="Role or team (optional)" aria-label="New person's note" class="flex-1" />
    <Button type="submit">Add Person</Button>
  </form>

  <ul class="space-y-2" aria-label="People">
    {#each peopleBloc.items as person (person.id)}
      {@const used = usage(person.id)}
      <li class="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-card border border-border rounded-lg shadow-sm">
        <Input
          value={person.name}
          aria-label="Name"
          class="h-8 text-sm font-medium sm:w-56"
          onchange={(e) => peopleBloc.update(person.id, { name: e.currentTarget.value })}
        />
        <Input
          value={person.note}
          placeholder="Role or team"
          aria-label="Note for {person.name}"
          class="h-8 text-sm flex-1"
          onchange={(e) => peopleBloc.update(person.id, { note: e.currentTarget.value.trim() })}
        />
        <div class="flex items-center justify-between sm:justify-end gap-2">
          <span class="text-xs text-muted-foreground whitespace-nowrap">{used} task{used === 1 ? "" : "s"}</span>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            aria-label="Delete {person.name}"
            title="Delete"
            onclick={() => handleDelete(person.id, person.name)}
          >
            <Trash2 />
          </Button>
        </div>
      </li>
    {:else}
      <li class="p-8 text-center border border-dashed rounded-lg text-sm text-muted-foreground">
        No people yet. Add the first one above.
      </li>
    {/each}
  </ul>
</div>
