<script lang="ts">
  import { getAdminSchema, ApiError } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import MermaidDiagram from "$lib/components/MermaidDiagram.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
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
      error = err instanceof ApiError ? err.message : "Schéma indisponible";
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
      label: "Base de données",
      regenerate: "pnpm --filter @loomkeep/api exec prisma generate",
    },
    {
      value: "modules",
      label: "Modules",
      regenerate: "pnpm --filter @loomkeep/api run graph",
    },
  ];

  const active = $derived(TABS.find((t) => t.value === tab)!);
  const activeGraph = $derived(tab === "erd" ? data?.erd : data?.modules);
</script>

<div class="px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="library"
    title="Schéma"
    subtitle="Graphe de la base de données et des modules de l'app, générés localement."
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
        Pas encore généré pour cette session de développement (fichier absent de <code
          class="text-fg">docs/</code
        >, ignoré par git).
      </p>
      <p class="mt-3">Génère-le avec :</p>
      <pre
        class="border-border bg-surface-2 text-fg mt-2 overflow-x-auto rounded-lg border p-3 text-xs">{active.regenerate}</pre>
      <p class="mt-3">Puis rafraîchis cette page.</p>
    </div>
  {/if}
</div>
