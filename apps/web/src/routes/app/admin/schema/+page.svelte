<script lang="ts">
  import { goto } from "$app/navigation";
  import { getAdminSchema } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import MermaidDiagram from "$lib/components/MermaidDiagram.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";

  // Direct-URL access outside dev: the underlying docs/erd.md
  // is never generated in the Docker build (DISABLE_ERD),
  // so there's nothing to show — bounce to the admin home instead.
  $effect(() => {
    if (!appConfig.erdEnabled) void goto("/app/admin");
  });

  const schemaQuery = createApiQuery(() => ({
    key: keys.admin.schema(),
    fetch: getAdminSchema,
    enabled: auth.isAdmin,
  }));
  const data = $derived(schemaQuery.data);
  const loading = $derived(schemaQuery.loading);
  const error = $derived(schemaQuery.error);
</script>

<div class="px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="library"
    title={m.admin_schema_title()}
    subtitle={m.admin_schema_subtitle()}
    class="mb-6" />

  {#if error}
    <Banner variant="error">{error}</Banner>
  {:else if loading && !data}
    <div class="card h-64 animate-pulse"></div>
  {:else if data?.erd}
    <MermaidDiagram code={data.erd} />
  {:else}
    <div class="card text-dim p-6 text-sm">
      <p>
        {m.admin_schema_not_generated()}
      </p>
      <p class="mt-3">{m.admin_schema_regenerate_hint()}</p>
      <pre
        class="border-border bg-surface-2 text-fg mt-2 overflow-x-auto rounded-lg border p-3 text-xs">pnpm --filter @loomkeep/api exec prisma generate</pre>
      <p class="mt-3">{m.admin_schema_refresh_hint()}</p>
    </div>
  {/if}
</div>
