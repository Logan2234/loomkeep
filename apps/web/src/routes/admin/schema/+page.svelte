<script lang="ts">
  import { getAdminSchema, ApiError } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import MermaidDiagram from "$lib/components/MermaidDiagram.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { SchemaGraphResponseDto } from "@loomkeep/shared";

  type Tab = "erd" | "modules";

  let data = $state<SchemaGraphResponseDto | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let tab = $state<Tab>("erd");

  async function load() {
    loading = true;
    error = null;
    try {
      data = await getAdminSchema();
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : m.admin_schema_fetch_error();
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (auth.isAdmin) void load();
  });

  const TABS: { value: Tab; label: string; regenerate: string }[] = [
    {
      value: "erd",
      label: m.admin_schema_tab_database(),
      regenerate: "pnpm --filter @loomkeep/api exec prisma generate",
    },
    {
      value: "modules",
      label: m.admin_schema_tab_modules(),
      regenerate: "pnpm --filter @loomkeep/api run graph",
    },
  ];

  const active = $derived(TABS.find((t) => t.value === tab)!);
  const activeGraph = $derived(tab === "erd" ? data?.erd : data?.modules);
</script>

<div class="px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="library"
    title={m.admin_schema_title()}
    subtitle={m.admin_schema_subtitle()}
    class="mb-6" />

  <div class="mb-5 flex flex-wrap gap-2">
    {#each TABS as t (t.value)}
      <button
        class="chip"
        class:chip-on={tab === t.value}
        onclick={() => (tab = t.value)}>
        {t.label}
      </button>
    {/each}
  </div>

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if loading && !data}
    <div class="card h-64 animate-pulse"></div>
  {:else if activeGraph}
    <MermaidDiagram code={activeGraph} />
  {:else}
    <div class="card text-dim p-6 text-sm">
      <p>
        {m.admin_schema_not_generated()}
      </p>
      <p class="mt-3">{m.admin_schema_regenerate_hint()}</p>
      <pre
        class="border-border bg-surface-2 text-fg mt-2 overflow-x-auto rounded-lg border p-3 text-xs">{active.regenerate}</pre>
      <p class="mt-3">{m.admin_schema_refresh_hint()}</p>
    </div>
  {/if}
</div>
