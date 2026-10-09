<script lang="ts">
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Eye, EyeOff, RefreshCw } from "@lucide/svelte";
  import { syncBloc } from "../app_context";
  import SyncIndicator from "../components/SyncIndicator.svelte";
  import { labelClass } from "../styles";

  let token = $state(syncBloc.config.token);
  let enabled = $state(syncBloc.config.enabled);
  let showToken = $state(false);
  let saved = $state(false);

  const status = $derived(syncBloc.status);
  const dirty = $derived(token.trim() !== syncBloc.config.token || enabled !== syncBloc.config.enabled);

  function save(e: SubmitEvent) {
    e.preventDefault();
    syncBloc.save({ enabled, token });
    saved = true;
    setTimeout(() => (saved = false), 1500);
  }

  function formatTime(at: number | null): string {
    return at ? new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never";
  }
</script>

<div class="space-y-8 max-w-xl">
  <header class="space-y-1">
    <h1 class="text-2xl font-bold tracking-tight">Sync</h1>
    <p class="text-sm text-muted-foreground">
      Everything is saved on this device first and works offline. With sync on, changes are sent to the Tym server
      that hosts this app, and changes from your other devices come back.
    </p>
  </header>

  <section class="rounded-lg border border-border bg-card p-4 space-y-3" aria-labelledby="sync-status-heading">
    <div class="flex items-center justify-between gap-2">
      <h2 id="sync-status-heading" class="font-semibold">Status</h2>
      <Button
        variant="secondary"
        size="sm"
        class="gap-1.5"
        disabled={!syncBloc.config.enabled || status.phase === "syncing"}
        onclick={() => syncBloc.syncNow()}
      >
        <RefreshCw class="size-3.5 {status.phase === 'syncing' ? 'animate-spin' : ''}" /> Sync now
      </Button>
    </div>
    <div class="-mx-3"><SyncIndicator /></div>
    <dl class="grid grid-cols-2 gap-3 text-sm">
      <div>
        <dt class={labelClass}>Changes waiting to sync</dt>
        <dd class="tabular-nums">{status.pending}</dd>
      </div>
      <div>
        <dt class={labelClass}>Last synced</dt>
        <dd>{formatTime(status.lastSyncedAt)}</dd>
      </div>
    </dl>
    {#if status.error}
      <p role="alert" class="text-sm text-destructive">{status.error}</p>
    {/if}
  </section>

  <form onsubmit={save} class="space-y-4" aria-labelledby="sync-settings-heading">
    <h2 id="sync-settings-heading" class="font-semibold">Settings</h2>
    <div class="space-y-1">
      <label for="sync-token" class={labelClass}>Sync token</label>
      <div class="flex gap-2">
        <Input
          id="sync-token"
          type={showToken ? "text" : "password"}
          autocomplete="off"
          spellcheck={false}
          placeholder="The TYM_TOKEN the server was started with"
          bind:value={token}
          class="flex-1 font-mono"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={showToken ? "Hide token" : "Show token"}
          onclick={() => (showToken = !showToken)}
        >
          {#if showToken}<EyeOff />{:else}<Eye />{/if}
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">Stored only on this device. Every device you sync needs the same token.</p>
    </div>
    <div class="flex items-center gap-2 text-sm">
      <Checkbox id="sync-enabled" checked={enabled} onCheckedChange={(v) => (enabled = v === true)} />
      <label for="sync-enabled">Sync with the server</label>
    </div>
    <div class="flex items-center gap-3">
      <Button type="submit" disabled={!dirty}>Save</Button>
      {#if saved}<span class="text-sm text-muted-foreground" aria-live="polite">Saved</span>{/if}
    </div>
  </form>
</div>
