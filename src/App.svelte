<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { theme } from "$lib/theme.svelte";
  import { router } from "$lib/router.svelte";
  import { Sun, Moon, Monitor, ListTodo, Users, Tags, Workflow, RefreshCw } from "@lucide/svelte";
  import TasksPage from "./presentation/pages/TasksPage.svelte";
  import TaskDetailPage from "./presentation/pages/TaskDetailPage.svelte";
  import PeoplePage from "./presentation/pages/PeoplePage.svelte";
  import TaskTypesPage from "./presentation/pages/TaskTypesPage.svelte";
  import WorkflowPage from "./presentation/pages/WorkflowPage.svelte";
  import SyncPage from "./presentation/pages/SyncPage.svelte";
  import SyncIndicator from "./presentation/components/SyncIndicator.svelte";
  import Notices from "./presentation/components/Notices.svelte";
  import { taskBloc } from "./presentation/app_context";

  $effect(() => theme.init());

  // The "let them know" prompt belongs to the page where the status changed.
  $effect(() => {
    router.path;
    taskBloc.lastStatusChange = null;
  });

  const nav = [
    { path: "/", label: "Tasks", icon: ListTodo },
    { path: "/people", label: "People", icon: Users },
    { path: "/types", label: "Task Types", icon: Tags },
    { path: "/workflow", label: "Statuses & Workflow", icon: Workflow },
    { path: "/sync", label: "Sync", icon: RefreshCw },
  ];

  const taskDetailId = $derived(router.path.match(/^\/tasks\/([^/]+)$/)?.[1] ?? null);

  function isActive(path: string): boolean {
    if (path === "/") return router.path === "/" || router.path.startsWith("/tasks");
    return router.path.startsWith(path);
  }
</script>

<div class="min-h-screen bg-background text-foreground md:flex">
  <aside
    class="relative md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
  >
    <div class="flex items-center justify-between gap-2 px-4 py-3 md:py-5">
      <a href="#/" class="space-y-0.5">
        <span class="block text-xl font-bold tracking-tight">Tym</span>
        <span class="hidden md:block text-xs text-muted-foreground">Local-first Task Management</span>
      </a>
      <Button
        variant="ghost"
        size="icon"
        onclick={() => theme.cycle()}
        aria-label={`Theme: ${theme.current}, activate to switch to ${theme.next()}`}
        title={`Theme: ${theme.current} (click for ${theme.next()})`}
      >
        {#if theme.current === "light"}
          <Sun />
        {:else if theme.current === "dark"}
          <Moon />
        {:else}
          <Monitor />
        {/if}
      </Button>
    </div>
    <nav aria-label="Main" class="flex md:flex-col gap-1 overflow-x-auto px-2 pb-2 md:pb-0">
      {#each nav as item (item.path)}
        {@const active = isActive(item.path)}
        <a
          href="#{item.path}"
          aria-current={active ? "page" : undefined}
          class="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors {active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'}"
        >
          <item.icon class="size-4" />
          {item.label}
        </a>
      {/each}
    </nav>
    <div class="hidden md:block absolute bottom-0 inset-x-0 p-2 border-t border-sidebar-border">
      <SyncIndicator />
    </div>
  </aside>

  <main class="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-10">
    <div class="mx-auto w-full max-w-4xl pb-24">
      {#if taskDetailId}
        {#key taskDetailId}
          <TaskDetailPage id={taskDetailId} />
        {/key}
      {:else if router.path.startsWith("/people")}
        <PeoplePage />
      {:else if router.path.startsWith("/types")}
        <TaskTypesPage />
      {:else if router.path.startsWith("/workflow")}
        <WorkflowPage />
      {:else if router.path.startsWith("/sync")}
        <SyncPage />
      {:else}
        <TasksPage />
      {/if}
    </div>
  </main>

  <Notices />
</div>
