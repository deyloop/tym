<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Trash2, ChevronUp, ChevronDown, CircleAlert } from "@lucide/svelte";
  import { STATUS_CATEGORY_LABELS, type StatusCategory } from "../../domain/models/workflow.model";
  import { taskBloc, workflowBloc } from "../app_context";
  import Badge from "../components/Badge.svelte";
  import ColorPicker from "../components/ColorPicker.svelte";
  import { fieldClass, labelClass } from "../styles";

  let name = $state("");
  let description = $state("");

  const statuses = $derived(workflowBloc.statuses);
  const initialId = $derived(workflowBloc.workflow.initialStatusId);
  const categories = Object.entries(STATUS_CATEGORY_LABELS) as [StatusCategory, string][];

  function usage(id: string): number {
    return taskBloc.countWhere((t) => t.statusId === id);
  }

  /** Statuses a task can never reach, or never leave (other than done/cancelled ones). */
  const warnings = $derived.by(() => {
    const result: string[] = [];
    for (const s of statuses) {
      const incoming = workflowBloc.workflow.transitions.some((t) => t.to === s.id);
      const outgoing = workflowBloc.workflow.transitions.some((t) => t.from === s.id);
      if (!incoming && s.id !== initialId) result.push(`${s.name} can't be reached from any other status.`);
      if (!outgoing && (s.category === "todo" || s.category === "in_progress")) {
        result.push(`${s.name} is an open status with no way out.`);
      }
    }
    return result;
  });

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    await workflowBloc.addStatus(name, description);
    name = "";
    description = "";
  }

  function outgoing(id: string): string {
    const names = workflowBloc.allowedTargets(id).map((s) => s.name);
    return names.length > 0 ? names.join(", ") : "nothing";
  }
</script>

<div class="space-y-10">
  <header class="space-y-1">
    <h1 class="text-2xl font-bold tracking-tight">Statuses &amp; Workflow</h1>
    <p class="text-sm text-muted-foreground">
      Define the statuses a task can be in and which moves between them are allowed. A status's description shows
      when you hover over it.
    </p>
  </header>

  <section class="space-y-4" aria-labelledby="statuses-heading">
    <h2 id="statuses-heading" class="text-lg font-semibold">Statuses</h2>

    <form onsubmit={handleCreate} class="flex flex-col sm:flex-row gap-2">
      <Input bind:value={name} placeholder="Status name, e.g. ON HOLD" aria-label="New status name" class="sm:w-56" />
      <Input bind:value={description} placeholder="What this status means" aria-label="New status description" class="flex-1" />
      <Button type="submit">Add Status</Button>
    </form>

    <ul class="space-y-2" aria-label="Statuses">
      {#each statuses as status, i (status.id)}
        {@const used = usage(status.id)}
        {@const isInitial = status.id === initialId}
        <li class="p-3 bg-card border border-border rounded-lg shadow-sm space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <Badge color={status.color} title={status.description}>{status.name}</Badge>
            {#if isInitial}
              <span class="text-xs text-muted-foreground">Initial status for new tasks</span>
            {/if}
            <span class="ml-auto text-xs text-muted-foreground">{used} task{used === 1 ? "" : "s"}</span>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label="Move {status.name} up"
              disabled={i === 0}
              onclick={() => workflowBloc.moveStatus(status.id, -1)}
            >
              <ChevronUp />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label="Move {status.name} down"
              disabled={i === statuses.length - 1}
              onclick={() => workflowBloc.moveStatus(status.id, 1)}
            >
              <ChevronDown />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
              aria-label="Delete {status.name}"
              title={used > 0
                ? `Used by ${used} task(s); move them to another status first`
                : isInitial
                  ? "Choose another initial status first"
                  : "Delete"}
              disabled={used > 0 || isInitial}
              onclick={() => workflowBloc.deleteStatus(status.id)}
            >
              <Trash2 />
            </Button>
          </div>

          <div class="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <label class="space-y-1">
              <span class={labelClass}>Name</span>
              <Input
                value={status.name}
                class="h-8 text-sm"
                onchange={(e) => workflowBloc.updateStatus(status.id, { name: e.currentTarget.value.trim() })}
              />
            </label>
            <label class="space-y-1">
              <span class={labelClass}>Description</span>
              <Input
                value={status.description}
                class="h-8 text-sm"
                onchange={(e) => workflowBloc.updateStatus(status.id, { description: e.currentTarget.value.trim() })}
              />
            </label>
          </div>

          <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
            <label class="space-y-1">
              <span class={labelClass}>Counts as</span>
              <select
                class="{fieldClass} h-8 w-40 [&>option]:bg-popover"
                value={status.category}
                onchange={(e) =>
                  workflowBloc.updateStatus(status.id, { category: e.currentTarget.value as StatusCategory })}
              >
                {#each categories as [value, label] (value)}
                  <option {value}>{label}</option>
                {/each}
              </select>
            </label>
            <div class="space-y-1">
              <span class={labelClass}>Color</span>
              <ColorPicker
                value={status.color}
                label="Color for {status.name}"
                onchange={(color) => workflowBloc.updateStatus(status.id, { color })}
              />
            </div>
            {#if !isInitial}
              <Button variant="outline" size="sm" onclick={() => workflowBloc.setInitialStatus(status.id)}>
                Make initial
              </Button>
            {/if}
          </div>

          <p class="text-xs text-muted-foreground">Can move to: {outgoing(status.id)}</p>
        </li>
      {/each}
    </ul>
  </section>

  <section class="space-y-4" aria-labelledby="transitions-heading">
    <div class="space-y-1">
      <h2 id="transitions-heading" class="text-lg font-semibold">Transitions</h2>
      <p class="text-sm text-muted-foreground">
        Tick a cell to allow moving a task from the row's status to the column's status.
      </p>
    </div>

    {#if warnings.length > 0}
      <ul class="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        {#each warnings as warning}
          <li class="flex items-start gap-2">
            <CircleAlert class="size-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />{warning}
          </li>
        {/each}
      </ul>
    {/if}

    <div class="overflow-x-auto rounded-lg border border-border bg-card">
      <table class="text-sm">
        <thead>
          <tr>
            <th scope="col" class="p-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
              From ↓ / To →
            </th>
            {#each statuses as to (to.id)}
              <th scope="col" class="p-2">
                <Badge color={to.color} title={to.description}>{to.name}</Badge>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each statuses as from (from.id)}
            <tr class="border-t border-border">
              <th scope="row" class="p-2 text-left">
                <Badge color={from.color} title={from.description}>{from.name}</Badge>
              </th>
              {#each statuses as to (to.id)}
                <td class="p-2 text-center">
                  {#if from.id === to.id}
                    <span class="text-muted-foreground" aria-hidden="true">—</span>
                  {:else}
                    <Checkbox
                      aria-label="Allow {from.name} to {to.name}"
                      checked={workflowBloc.canTransition(from.id, to.id)}
                      onCheckedChange={(checked) => workflowBloc.setTransition(from.id, to.id, checked === true)}
                    />
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</div>
