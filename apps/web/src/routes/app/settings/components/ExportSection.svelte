<script lang="ts">
  import { exportMyData, exportMyDataCsv } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import { Domain } from "@loomkeep/shared";

  let exporting = $state(false);
  let exportError = $state("");

  function downloadBlob(content: string, mimeType: string, filename: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadExport() {
    exporting = true;
    exportError = "";
    try {
      const data = await exportMyData();
      downloadBlob(
        JSON.stringify(data, null, 2),
        "application/json",
        `loomkeep-export-${new Date().toISOString().slice(0, 10)}.json`,
      );
      toast.success(m.settings_export_success());
    } catch (err) {
      exportError = resolveApiError(err);
    } finally {
      exporting = false;
    }
  }

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
    { domain: Domain.MUSIC, label: m.common_Music(), slug: "music" },
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

  let csvExporting = $state<Domain | null>(null);
  let csvError = $state("");

  async function downloadCsv(domain: Domain, slug: string) {
    csvExporting = domain;
    csvError = "";
    try {
      const { csv } = await exportMyDataCsv(domain);
      downloadBlob(
        csv,
        "text/csv",
        `loomkeep-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success(m.settings_export_success());
    } catch (err) {
      csvError = resolveApiError(err);
    } finally {
      csvExporting = null;
    }
  }
</script>

<section class="card mb-5 p-5 md:p-6">
  <h2 class="font-display mb-1 text-lg font-bold">
    {m.common_export()}
  </h2>
  <p class="text-dim mb-4 text-sm">
    {m.settings_export_body()}
  </p>
  <button class="btn btn-primary" disabled={exporting} onclick={downloadExport}>
    <Icon name="download" class="mr-1.5 inline h-4 w-4" />
    {exporting
      ? m.settings_export_action_loading()
      : m.settings_export_action()}
  </button>
  {#if exportError}
    <p class="text-danger mt-2 text-sm">{exportError}</p>
  {/if}

  <div class="border-border mt-5 border-t pt-5">
    <p class="text-dim mb-3 text-sm">
      {m.settings_export_csv_body()}
    </p>
    <div class="flex flex-wrap gap-2">
      {#each CSV_DOMAINS as d (d.domain)}
        {#if d.comingSoon}
          <!-- Planned domain: no data to export yet. -->
          <button
            class="btn btn-ghost"
            disabled
            title={m.settings_export_csv_coming_soon_hint()}>
            <Icon name="download" class="mr-1.5 inline h-4 w-4" />
            {d.label} (CSV) · {m.common_coming_soon()}
          </button>
        {:else}
          <button
            class="btn btn-ghost"
            disabled={csvExporting !== null}
            onclick={() => downloadCsv(d.domain, d.slug)}>
            <Icon name="download" class="mr-1.5 inline h-4 w-4" />
            {csvExporting === d.domain
              ? m.settings_export_action_loading()
              : `${d.label} (CSV)`}
          </button>
        {/if}
      {/each}
    </div>
    {#if csvError}
      <p class="text-danger mt-2 text-sm">{csvError}</p>
    {/if}
  </div>
</section>
