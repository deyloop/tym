<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { ArrowLeft, Trash2, History } from "@lucide/svelte";
  import { router } from "$lib/router.svelte";
  import {
    DATE_FIELDS,
    FIELD_LABELS,
    PERSON_FIELDS,
    descendantIds,
    type DateField,
    type PersonField,
    type TaskEvent,
    type TaskField,
  } from "../../domain/models/task.model";
  import { peopleBloc, taskBloc, taskTypeBloc, workflowBloc } from "../app_context";
  import Badge from "../components/Badge.svelte";
  import StatusSelect from "../components/StatusSelect.svelte";
  import {
    fieldClass,
    formatDate,
    formatHours,
    formatPct,
    labelClass,
    textareaClass,
    todayString,
  } from "../styles";

  let { id }: { id: string } = $props();

  const task = $derived(taskBloc.task(id));
  const node = $derived(taskBloc.nodeById.get(id));
  const rollup = $derived(taskBloc.rollups.get(id));
  const children = $derived(taskBloc.childrenOf(id));
  const status = $derived(task ? workflowBloc.status(task.statusId) : undefined);
  const done = $derived(task ? taskBloc.isDone(task) : false);
  const ancestors = $derived.by(() => {
    const chain = [];
    let current = task ? taskBloc.parentOf(task) : null;
    while (current) {
      const parent = taskBloc.task(current);
      if (!parent) break;
      chain.unshift(parent);
      current = taskBloc.parentOf(parent);
    }
    return chain;
  });
  /** Tasks that can become this task's parent: anything outside its own subtree. */
  const parentOptions = $derived.by(() => {
    const excluded = new Set([id, ...descendantIds(taskBloc.tasks, id)]);
    return taskBloc.tree.filter((n) => !excluded.has(n.task.id));
  });

  const PERSON_LABELS: Record<PersonField, string> = {
    reportedBy: "Reported by",
    owner: "Owner",
    delegatedTo: "Delegated to",
    reportingTo: "Reporting to",
    reviewer: "Reviewer",
  };
  const PERSON_HINTS: Partial<Record<PersonField, string>> = {
    reportingTo: "Prompted to update them whenever the status changes.",
  };
  const DATE_LABELS: Record<DateField, string> = {
    dueDate: "Due date",
    plannedStart: "Planned start",
    plannedEnd: "Planned end",
    devCompletionDate: "Dev completion",
    reviewDate: "Review date",
  };

  let subtaskTitle = $state("");
  let note = $state("");

  function update(field: TaskField, value: unknown) {
    taskBloc.updateTask(id, { [field]: value });
  }

  function parseHours(raw: string): number | null | undefined {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : undefined;
  }

  function setHours(field: "estimateHours" | "spentHours", raw: string) {
    const value = parseHours(raw);
    if (value !== undefined) update(field, value);
  }

  async function addSubtask(e: SubmitEvent) {
    e.preventDefault();
    await taskBloc.createTask(subtaskTitle, id);
    subtaskTitle = "";
  }

  async function addNote(e: SubmitEvent) {
    e.preventDefault();
    await taskBloc.addNote(id, note);
    note = "";
  }

  async function handleDelete() {
    if (!task) return;
    const extra = children.length > 0 ? " and all of its subtasks" : "";
    if (!confirm(`Delete "${task.title}"${extra}? This can't be undone.`)) return;
    const parent = taskBloc.parentOf(task);
    await taskBloc.deleteTask(id);
    router.go(parent ? `/tasks/${parent}` : "/");
  }

  function formatValue(field: TaskField | undefined, value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    switch (field) {
      case "statusId":
        return workflowBloc.status(value as string)?.name ?? "(removed status)";
      case "typeId":
        return taskTypeBloc.nameOf(value as string) ?? "(removed type)";
      case "parent": {
        const parent = taskBloc.task(value as string);
        return parent ? `#${taskBloc.nodeById.get(parent.id)?.lineage} ${parent.title}` : "(removed task)";
      }
      case "estimateHours":
      case "spentHours":
        return formatHours(value as number);
      case "description": {
        const text = String(value);
        return text.length > 80 ? `“${text.slice(0, 80)}…”` : `“${text}”`;
      }
      case "title":
        return `“${value}”`;
    }
    if (field && (PERSON_FIELDS as readonly string[]).includes(field)) {
      return peopleBloc.nameOf(value as string) ?? "(removed person)";
    }
    if (field && (DATE_FIELDS as readonly string[]).includes(field)) return formatDate(value as string);
    return String(value);
  }

  function formatTimestamp(at: number): string {
    return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function describe(event: TaskEvent): string {
    if (event.kind === "created") return "Task created";
    if (event.kind === "note") return event.text ?? "";
    if (event.field === "parent" && !event.to) return "Moved to top level";
    return `${FIELD_LABELS[event.field!]}: ${formatValue(event.field, event.from)} → ${formatValue(event.field, event.to)}`;
  }

  const history = $derived(task ? [...task.history].reverse() : []);
</script>

{#if !task}
  <div class="space-y-4">
    <a href="#/" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft class="size-4" /> Tasks
    </a>
    <p class="p-8 text-center border border-dashed rounded-lg text-sm text-muted-foreground">
      {taskBloc.loading ? "Loading…" : "This task doesn't exist (it may have been deleted)."}
    </p>
  </div>
{:else}
  <article class="space-y-8">
    <header class="space-y-3">
      <nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <a href="#/" class="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft class="size-4" /> Tasks</a>
        {#each ancestors as ancestor (ancestor.id)}
          <span aria-hidden="true">/</span>
          <a href="#/tasks/{ancestor.id}" class="hover:text-foreground truncate max-w-48">{ancestor.title}</a>
        {/each}
      </nav>

      <div class="flex items-start gap-3">
        <Input
          value={task.title}
          aria-label="Title"
          class="h-11 flex-1 text-lg md:text-lg font-semibold {done ? 'line-through text-muted-foreground' : ''}"
          onchange={(e) => update("title", e.currentTarget.value.trim())}
        />
        <Button
          variant="ghost"
          size="sm"
          class="h-11 w-11 p-0 text-muted-foreground hover:text-destructive"
          aria-label="Delete task"
          title="Delete task"
          onclick={handleDelete}
        >
          <Trash2 />
        </Button>
      </div>

      <dl class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <div class="flex gap-1.5"><dt>Lineage</dt><dd class="font-mono text-foreground">#{node?.lineage}</dd></div>
        <div class="flex gap-1.5"><dt>Level</dt><dd class="text-foreground">{node?.level}</dd></div>
        <div class="flex gap-1.5"><dt>Created</dt><dd class="text-foreground">{formatTimestamp(task.createdAt)}</dd></div>
      </dl>
    </header>

    <section class="grid gap-4 sm:grid-cols-3" aria-label="Classification">
      <div class="space-y-1">
        <span class={labelClass}>Status</span>
        <StatusSelect {task} variant="field" />
        {#if status?.description}
          <p class="text-xs text-muted-foreground">{status.description}</p>
        {/if}
      </div>
      <label class="space-y-1">
        <span class={labelClass}>Type</span>
        <select
          class="{fieldClass} [&>option]:bg-popover"
          value={task.typeId ?? ""}
          onchange={(e) => update("typeId", e.currentTarget.value || null)}
        >
          <option value="">—</option>
          {#each taskTypeBloc.items as type (type.id)}
            <option value={type.id}>{type.name}</option>
          {/each}
        </select>
      </label>
      <label class="space-y-1">
        <span class={labelClass}>Parent</span>
        <select
          class="{fieldClass} [&>option]:bg-popover"
          value={taskBloc.parentOf(task) ?? ""}
          onchange={(e) => update("parent", e.currentTarget.value || null)}
        >
          <option value="">— Top level</option>
          {#each parentOptions as option (option.task.id)}
            <option value={option.task.id}>
              {"  ".repeat(option.depth)}#{option.lineage} {option.task.title}
            </option>
          {/each}
        </select>
      </label>
    </section>

    <section class="space-y-1">
      <label for="task-description" class={labelClass}>Description</label>
      <textarea
        id="task-description"
        class={textareaClass}
        placeholder="Details, acceptance criteria, links…"
        value={task.description}
        onchange={(e) => update("description", e.currentTarget.value)}
      ></textarea>
    </section>

    <section class="space-y-3" aria-labelledby="people-heading">
      <div class="flex items-baseline justify-between gap-2">
        <h2 id="people-heading" class="font-semibold">People</h2>
        <a href="#/people" class="text-xs text-muted-foreground hover:text-foreground">Manage people</a>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each PERSON_FIELDS as field (field)}
          <label class="space-y-1">
            <span class={labelClass}>{PERSON_LABELS[field]}</span>
            <select
              class="{fieldClass} [&>option]:bg-popover"
              value={task[field] ?? ""}
              onchange={(e) => update(field, e.currentTarget.value || null)}
            >
              <option value="">—</option>
              {#each peopleBloc.items as person (person.id)}
                <option value={person.id}>{person.name}</option>
              {/each}
            </select>
            {#if PERSON_HINTS[field]}
              <p class="text-xs text-muted-foreground">{PERSON_HINTS[field]}</p>
            {/if}
          </label>
        {/each}
      </div>
      {#if peopleBloc.items.length === 0}
        <p class="text-sm text-muted-foreground">
          No people yet. <a href="#/people" class="underline hover:text-foreground">Add some</a> to assign them here.
        </p>
      {/if}
    </section>

    <section class="space-y-3" aria-labelledby="dates-heading">
      <h2 id="dates-heading" class="font-semibold">Dates</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each DATE_FIELDS as field (field)}
          {@const overdue = field === "dueDate" && !done && !!task.dueDate && task.dueDate < todayString()}
          <label class="space-y-1">
            <span class={labelClass}>{DATE_LABELS[field]}{overdue ? " · overdue" : ""}</span>
            <Input
              type="date"
              value={task[field] ?? ""}
              aria-invalid={overdue || undefined}
              onchange={(e) => update(field, e.currentTarget.value || null)}
            />
          </label>
        {/each}
      </div>
    </section>

    <section class="space-y-3" aria-labelledby="effort-heading">
      <h2 id="effort-heading" class="font-semibold">Effort &amp; progress</h2>
      {#if children.length === 0}
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label class="space-y-1">
            <span class={labelClass}>Estimate (hours)</span>
            <Input
              type="number"
              min="0"
              step="0.25"
              value={task.estimateHours ?? ""}
              onchange={(e) => setHours("estimateHours", e.currentTarget.value)}
            />
          </label>
          <label class="space-y-1">
            <span class={labelClass}>Time spent (hours)</span>
            <Input
              type="number"
              min="0"
              step="0.25"
              value={task.spentHours ?? ""}
              onchange={(e) => setHours("spentHours", e.currentTarget.value)}
            />
          </label>
          <div class="space-y-1">
            <span class={labelClass}>Remaining</span>
            <p class="h-9 flex items-center text-sm">{rollup ? formatHours(rollup.remaining) : "—"}</p>
          </div>
          <div class="space-y-1">
            <span class={labelClass}>Effort complete</span>
            <p class="h-9 flex items-center text-sm">{formatPct(rollup?.effortPct ?? null)}</p>
          </div>
        </div>
      {:else if rollup}
        <p class="text-sm text-muted-foreground">
          Rolled up from {rollup.leafCount} subtask{rollup.leafCount === 1 ? "" : "s"} at the bottom of this
          branch (cancelled ones are left out). Enter estimates and time on those.
        </p>
        <dl class="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {#each [["Estimate", formatHours(rollup.estimate)], ["Spent", formatHours(rollup.spent)], ["Remaining", formatHours(rollup.remaining)], ["Subtasks done", `${rollup.doneCount} / ${rollup.leafCount}`]] as [label, value] (label)}
            <div class="rounded-lg border border-border bg-card p-3">
              <dt class={labelClass}>{label}</dt>
              <dd class="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          {/each}
        </dl>
        <div class="space-y-3">
          {#each [["By effort", rollup.effortPct], ["By item count", rollup.countPct]] as [label, pct] (label)}
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-muted-foreground">{label}</span>
                <span class="tabular-nums">{formatPct(pct as number | null)}</span>
              </div>
              <div
                class="h-2 rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-label="Completion {label}"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={pct === null ? undefined : Math.round((pct as number) * 100)}
              >
                <div class="h-full rounded-full bg-primary" style:width="{((pct as number | null) ?? 0) * 100}%"></div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="space-y-3" aria-labelledby="subtasks-heading">
      <h2 id="subtasks-heading" class="font-semibold">Subtasks</h2>
      {#if children.length > 0}
        <ul class="divide-y divide-border rounded-lg border border-border bg-card">
          {#each children as child (child.id)}
            {@const childRollup = taskBloc.rollups.get(child.id)}
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
              <span class="font-mono text-xs text-muted-foreground">#{taskBloc.nodeById.get(child.id)?.lineage}</span>
              <a href="#/tasks/{child.id}" class="flex-1 min-w-0 truncate font-medium hover:underline">{child.title}</a>
              {#if childRollup && taskBloc.childrenOf(child.id).length > 0}
                <span class="text-xs text-muted-foreground">{childRollup.doneCount}/{childRollup.leafCount} done</span>
              {/if}
              <StatusSelect task={child} />
            </li>
          {/each}
        </ul>
      {/if}
      <form onsubmit={addSubtask} class="flex gap-2">
        <Input bind:value={subtaskTitle} placeholder="New subtask" aria-label="New subtask title" class="flex-1" />
        <Button type="submit" variant="secondary">Add Subtask</Button>
      </form>
    </section>

    <section class="space-y-3" aria-labelledby="history-heading">
      <h2 id="history-heading" class="font-semibold inline-flex items-center gap-2"><History class="size-4" /> History</h2>
      <form onsubmit={addNote} class="flex gap-2">
        <Input bind:value={note} placeholder="Add a note (e.g. why it's blocked)" aria-label="Note" class="flex-1" />
        <Button type="submit" variant="secondary">Add Note</Button>
      </form>
      <ol class="space-y-2 border-l border-border pl-4">
        {#each history as event, i (i)}
          <li class="relative text-sm">
            <span
              class="absolute -left-[1.3rem] top-1.5 size-2 rounded-full {event.kind === 'note'
                ? 'bg-primary'
                : 'bg-muted-foreground/50'}"
              aria-hidden="true"
            ></span>
            {#if event.kind === "change" && event.field === "statusId"}
              {@const from = workflowBloc.status(event.from as string)}
              {@const to = workflowBloc.status(event.to as string)}
              <p class="flex flex-wrap items-center gap-1">
                Status:
                {#if from}<Badge color={from.color} title={from.description}>{from.name}</Badge>{:else}(removed){/if}
                →
                {#if to}<Badge color={to.color} title={to.description}>{to.name}</Badge>{:else}(removed){/if}
              </p>
            {:else}
              <p class={event.kind === "note" ? "whitespace-pre-wrap" : ""}>{describe(event)}</p>
            {/if}
            <p class="text-xs text-muted-foreground">
              {formatTimestamp(event.at)}{event.kind === "note" ? " · note" : ""}
            </p>
          </li>
        {/each}
      </ol>
    </section>
  </article>
{/if}
