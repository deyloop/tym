<script lang="ts">
  import { CloudCheck, CloudOff, Cloud, RefreshCw, TriangleAlert } from "@lucide/svelte";
  import { syncBloc } from "../app_context";

  const status = $derived(syncBloc.status);
  const label = $derived.by(() => {
    switch (status.phase) {
      case "disabled":
        return "Sync off";
      case "offline":
        return status.pending > 0 ? `Offline · ${status.pending} to sync` : "Offline";
      case "unreachable":
        return status.pending > 0 ? `Server unreachable · ${status.pending} to sync` : "Server unreachable";
      case "syncing":
        return "Syncing…";
      case "error":
        return "Sync failed";
      case "unauthorized":
        return "Sync token rejected";
      default:
        return status.pending > 0 ? `${status.pending} to sync` : "Synced";
    }
  });
</script>

<a
  href="#/sync"
  class="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
  title="Sync settings"
>
  {#if status.phase === "syncing"}
    <RefreshCw class="size-3.5 animate-spin" />
  {:else if status.phase === "error" || status.phase === "unauthorized"}
    <TriangleAlert class="size-3.5 text-destructive" />
  {:else if status.phase === "offline" || status.phase === "unreachable" || status.phase === "disabled"}
    <CloudOff class="size-3.5" />
  {:else if status.pending > 0}
    <Cloud class="size-3.5" />
  {:else}
    <CloudCheck class="size-3.5" />
  {/if}
  <span aria-live="polite">{label}</span>
</a>
