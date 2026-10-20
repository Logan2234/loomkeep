<script lang="ts">
  import { DOMAINS } from "#lib/constants/domains.js";

  import SettingsSection from "../components/SettingsSection.svelte";
  import MigrationExportCard from "./MigrationExportCard.svelte";

  import { page } from "$app/state";
  import { exportMyData, exportMyDataCsv } from "#lib/api/client.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { downloadBlob, datedFilename } from "#lib/download.js";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import { Domain } from "@loomkeep/shared";
  import { flashAnchor } from "#lib/flash-anchor.js";

  const exportMut = createApiMutation(() => ({
    mutate: exportMyData,
    onSuccess: (data) => {
      downloadBlob(
        JSON.stringify(data, null, 2),
        "application/json",
        datedFilename(`loomkeep-export`, "json"),
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
    { domain: Domain.BOOKS, label: DOMAINS.BOOKS.label, slug: "books" },
    { domain: Domain.GAMES, label: DOMAINS.GAMES.label, slug: "games" },
    { domain: Domain.MUSIC, label: DOMAINS.MUSIC.label, slug: "music" },
    {
      domain: Domain.PODCASTS,
      label: DOMAINS.PODCASTS.label,
      slug: "podcasts",
      comingSoon: true,
    },
    {
      domain: Domain.BOARDGAMES,
      label: DOMAINS.BOARDGAMES.label,
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
        datedFilename(`loomkeep-${args.slug}`, "csv"),
      );
      toast.success(m.settings_export_success());
    },
  }));

  function downloadCsv(domain: Domain, slug: string) {
    csvExportMut.mutate({ domain, slug });
  }

  const exportableDomains = CSV_DOMAINS.filter((d) => !d.comingSoon);
  const plannedDomains = CSV_DOMAINS.filter((d) => d.comingSoon)
    .map((d) => d.label)
    .join(", ");
</script>

<SettingsSection slug="export">
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

    <MigrationExportCard />
  </div>
</SettingsSection>
