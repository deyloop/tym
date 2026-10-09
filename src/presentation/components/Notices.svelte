<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Copy, Check, X, CircleAlert } from "@lucide/svelte";
  import { peopleBloc, taskBloc, taskTypeBloc, workflowBloc } from "../app_context";

  const notice = $derived(taskBloc.lastStatusChange);
  const task = $derived(notice ? taskBloc.task(notice.taskId) : undefined);
  const reportTo = $derived(peopleBloc.nameOf(task?.reportingTo));
  const message = $derived.by(() => {
    if (!notice || !task) return "";
    const lineage = taskBloc.nodeById.get(task.id)?.lineage ?? task.number;
    const from = workflowBloc.status(notice.from)?.name ?? "?";
    const to = workflowBloc.status(notice.to)?.name ?? "?";
    return `Task #${lineage} "${task.title}" moved from ${from} to ${to}.`;
  });
  const errors = $derived(
    [taskBloc, workflowBloc, peopleBloc, taskTypeBloc].filter((b) => b.error),
  );

  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // Clipboard can be unavailable (permissions, insecure context); the text stays visible to copy by hand.
    }
  }
</script>

<div class="fixed bottom-4 inset-x-4 z-50 flex flex-col items-center gap-2 pointer-events-none" aria-live="polite">
  {#each errors as bloc}
    <div
      role="alert"
      class="pointer-events-auto flex w-full max-w-lg items-start gap-2 rounded-lg border border-destructive/40 bg-card p-3 text-sm shadow-lg"
    >
      <CircleAlert class="size-4 mt-0.5 shrink-0 text-destructive" />
      <p class="flex-1">{bloc.error}</p>
      <Button variant="ghost" size="sm" class="h-6 w-6 p-0" aria-label="Dismiss" onclick={() => (bloc.error = null)}>
        <X />
      </Button>
    </div>
  {/each}

  {#if task && reportTo}
    <div class="pointer-events-auto w-full max-w-lg rounded-lg border border-border bg-card p-3 text-sm shadow-lg">
      <div class="flex items-start gap-2">
        <div class="flex-1 space-y-1">
          <p class="font-medium">Let {reportTo} know</p>
          <p class="text-muted-foreground">{message}</p>
        </div>
        <Button variant="ghost" size="sm" class="h-7 gap-1 px-2" onclick={copy}>
          {#if copied}<Check class="size-3.5" /> Copied{:else}<Copy class="size-3.5" /> Copy{/if}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 w-7 p-0"
          aria-label="Dismiss"
          onclick={() => (taskBloc.lastStatusChange = null)}
        >
          <X />
        </Button>
      </div>
    </div>
  {/if}
</div>
