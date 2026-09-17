<script lang="ts">
  import { exportMyData, exportMyDataCsv } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { page } from "$app/state";
  import Icon from "$lib/components/Icon.svelte";
  import { downloadBlob } from "$lib/download";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import { Domain } from "@loomkeep/shared";
  import { flashAnchor } from "../flash-anchor";

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

  // Four permanently disabled buttons read as four broken promises. The
  // planned domains say so once, in a line, instead.
  const exportableDomains = CSV_DOMAINS.filter((d) => !d.comingSoon);
  const plannedDomains = CSV_DOMAINS.filter((d) => d.comingSoon)
    .map((d) => d.label)
    .join(", ");
</script>

<div class="space-y-3">
  <section
    id="export-json"
    use:flashAnchor={{ anchor: "export-json", hash: page.url.hash }}
    class="card p-5 md:p-6">
    <p class="font-semibold">{m.settings_export_json_title()}</p>
    <p class="text-dim mt-1 max-w-xl text-sm">
      {m.settings_export_json_description()}
    </p>
    <button
      class="btn btn-primary mt-4"
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
  </section>

  <section
    id="export-csv"
    use:flashAnchor={{ anchor: "export-csv", hash: page.url.hash }}
    class="card p-5 md:p-6">
    <p class="text-dim mb-3 text-sm">{m.settings_export_csv_body()}</p>
    <div class="flex flex-wrap gap-2">
      {#each exportableDomains as d (d.domain)}
        <button
          class="btn btn-ghost"
          disabled={csvExportMut.loading}
          onclick={() => downloadCsv(d.domain, d.slug)}>
          <Icon name="download" class="mr-1.5 inline h-4 w-4" />
          {csvExportMut.loading && csvExportMut.variables?.domain === d.domain
            ? m.settings_export_action_loading()
            : `${d.label} (CSV)`}
        </button>
      {/each}
    </div>
    {#if plannedDomains}
      <p class="timecode mt-3 text-xs">
        {m.settings_export_coming_soon_label({ domains: plannedDomains })}
      </p>
    {/if}
    {#if csvExportMut.error}
      <p class="text-danger mt-2 text-sm">{csvExportMut.error}</p>
    {/if}
  </section>
</div>
