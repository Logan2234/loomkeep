<script lang="ts">
  import { exportMyData, exportMyDataCsv } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { downloadBlob } from "$lib/download";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import { Domain } from "@loomkeep/shared";

  const exportMut = createApiMutation(() => ({
    mutate: exportMyData,
    onSuccess: (data) => {
      downloadBlob(
        JSON.stringify(data, null, 2),
        "application/json",
        `loomkeep-export-${new Date().toISOString().slice(0, 10)}.json`,
      );
      toast.success(m.settings_export_success());
    },
  }));

  const CSV_DOMAINS: {
    domain: Domain;
    label: string;
    slug: string;
    comingSoon?: boolean;
  }[] = [
    {
      domain: Domain.MEDIA,
      label: m.settings_export_media_label(),
      slug: "media",
    },
    { domain: Domain.BOOKS, label: m.common_Books(), slug: "books" },
    { domain: Domain.GAMES, label: m.common_Games(), slug: "games" },
    {
      domain: Domain.MUSIC,
      label: m.common_Music(),
      slug: "music",
      comingSoon: true,
    },
    {
      domain: Domain.PODCASTS,
      label: m.common_Podcasts(),
      slug: "podcasts",
      comingSoon: true,
    },
    {
      domain: Domain.BOARDGAMES,
      label: m.common_Boardgames(),
      slug: "boardgames",
      comingSoon: true,
    },
  ];

  const csvExportMut = createApiMutation(() => ({
    mutate: (args: { domain: Domain; slug: string }) =>
      exportMyDataCsv(args.domain),
    onSuccess: ({ csv }, args) => {
      downloadBlob(
        csv,
        "text/csv",
        `loomkeep-${args.slug}-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success(m.settings_export_success());
    },
  }));

  function downloadCsv(domain: Domain, slug: string) {
    csvExportMut.mutate({ domain, slug });
  }
</script>

<section class="card mb-5 p-5 md:p-6">
  <h2 class="font-display mb-1 text-lg font-bold">
    {m.common_export()}
  </h2>
  <p class="text-dim mb-4 text-sm">
    {m.settings_export_body()}
  </p>
  <button
    class="btn btn-primary"
    disabled={exportMut.loading}
    onclick={() => exportMut.mutate()}>
    <Icon name="download" class="mr-1.5 inline h-4 w-4" />
    {exportMut.loading
      ? m.settings_export_action_loading()
      : m.settings_export_action()}
  </button>
  {#if exportMut.error}
    <p class="text-danger mt-2 text-sm">{exportMut.error}</p>
  {/if}

  <div class="border-border mt-5 border-t pt-5">
    <p class="text-dim mb-3 text-sm">
      {m.settings_export_csv_body()}
    </p>
    <div class="flex flex-wrap gap-2">
      {#each CSV_DOMAINS as d (d.domain)}
        {#if d.comingSoon}
          <!-- Planned domain: no data to export yet. -->
          <button class="btn btn-ghost" disabled title={m.common_coming_soon()}>
            <Icon name="download" class="mr-1.5 inline h-4 w-4" />
            {d.label} (CSV) · {m.common_coming_soon()}
          </button>
        {:else}
          <button
            class="btn btn-ghost"
            disabled={csvExportMut.loading}
            onclick={() => downloadCsv(d.domain, d.slug)}>
            <Icon name="download" class="mr-1.5 inline h-4 w-4" />
            {csvExportMut.loading && csvExportMut.variables?.domain === d.domain
              ? m.settings_export_action_loading()
              : `${d.label} (CSV)`}
          </button>
        {/if}
      {/each}
    </div>
    {#if csvExportMut.error}
      <p class="text-danger mt-2 text-sm">{csvExportMut.error}</p>
    {/if}
  </div>
</section>
