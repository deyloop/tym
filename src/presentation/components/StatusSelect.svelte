<script lang="ts">
  import type { Task } from "../../domain/models/task.model";
  import { taskBloc, workflowBloc } from "../app_context";
  import { BADGE_CLASSES, fieldClass } from "../styles";

  /** `badge` renders compactly for list rows; otherwise it looks like a form field. */
  let { task, variant = "badge" }: { task: Task; variant?: "badge" | "field" } = $props();

  const current = $derived(workflowBloc.status(task.statusId));
  const targets = $derived(workflowBloc.allowedTargets(task.statusId));
</script>

<select
  aria-label="Status of {task.title}"
  title={current?.description ? `${current.name}: ${current.description}` : current?.name}
  value={task.statusId}
  disabled={targets.length === 0}
  onchange={(e) => taskBloc.updateTask(task.id, { statusId: e.currentTarget.value })}
  class="[&>option]:bg-popover [&>option]:text-popover-foreground {variant === 'badge'
    ? `[field-sizing:content] appearance-none cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default ${BADGE_CLASSES[current?.color ?? 'gray']}`
    : fieldClass}"
>
  <option value={task.statusId}>{current?.name ?? "Unknown status"}</option>
  {#each targets as status (status.id)}
    <option value={status.id} title={status.description}>→ {status.name}</option>
  {/each}
</select>
