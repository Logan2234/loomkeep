<script lang="ts">
  import { page } from "$app/state";
  import { exportForGoodreads, exportForLetterboxd } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { downloadBlob } from "$lib/download";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import type { MigrationExportDto } from "@loomkeep/shared";
  import { flashAnchor } from "../flash-anchor";

  type Service = "letterboxd" | "goodreads";

  const SERVICES: {
    id: Service;
    name: string;
    action: string;
    description: string;
  }[] = [
    {
      id: "letterboxd",
      name: "Letterboxd",
      action: "Letterboxd",
      description: m.settings_export_letterboxd_description(),
    },
    {
      id: "goodreads",
      name: "Goodreads · StoryGraph",
      action: "Goodreads",
      description: m.settings_export_goodreads_description(),
    },
  ];

  let withReviews = $state(false);
  let letterboxdFiles = $state<string[]>([]);

  // Browsers drop some of several downloads fired in the same tick.
  const DOWNLOAD_GAP_MS = 300;

  async function downloadAll({ files }: MigrationExportDto) {
    const date = new Date().toISOString().slice(0, 10);

    for (const [index, file] of files.entries()) {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_GAP_MS));
      }
      downloadBlob(file.csv, "text/csv", `loomkeep-${file.name}-${date}.csv`);
    }
  }

  const exportMut = createApiMutation(() => ({
    mutate: (service: Service) =>
      service === "letterboxd"
        ? exportForLetterboxd(withReviews)
        : exportForGoodreads(withReviews),
    onSuccess: (data, service) => {
      if (data.files.length === 0) {
        toast.show(m.settings_export_services_empty());
        return;
      }

      void downloadAll(data);
      if (service === "letterboxd") {
        letterboxdFiles = data.files.map((f) => f.name);
      }
      toast.success(m.settings_export_success());
    },
  }));
</script>

<section
  id="export-services"
  use:flashAnchor={{ anchor: "export-services", hash: page.url.hash }}
  class="card p-5 md:p-6">
  <p class="flex items-center gap-2 font-semibold">
    {m.settings_export_services_title()}
    {#if isFeatureNew("migration-export")}
      <NewBadge />
    {/if}
  </p>
  <p class="text-dim mt-1 max-w-xl text-sm">
    {m.settings_export_services_body()}
  </p>

  <div class="border-border mt-4 flex items-start gap-4 border-t py-4">
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium">{m.settings_export_reviews_label()}</p>
      <p class="text-dim mt-0.5 max-w-xl text-xs">
        {m.settings_export_reviews_hint()}
      </p>
    </div>
    <Switch
      label={m.settings_export_reviews_label()}
      checked={withReviews}
      onChange={(value) => (withReviews = value)} />
  </div>

  {#each SERVICES as service (service.id)}
    <div
      class="border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t py-4 last:pb-0">
      <div class="min-w-0 flex-[1_1_14rem]">
        <p class="font-medium">{service.name}</p>
        <p class="text-dim text-sm">{service.description}</p>
      </div>
      <button
        class="btn btn-ghost"
        disabled={exportMut.loading}
        onclick={() => exportMut.mutate(service.id)}>
        <Icon name="download" class="mr-1.5 inline h-4 w-4" />
        {exportMut.loading && exportMut.variables === service.id
          ? m.settings_export_action_loading()
          : service.action}
      </button>
    </div>
  {/each}

  {#if letterboxdFiles.length > 1}
    <p class="bg-surface-2 mt-4 rounded-lg px-3 py-2.5 text-sm">
      {m.settings_export_letterboxd_notice({
        count: letterboxdFiles.length,
        files: letterboxdFiles.join(", "),
      })}
    </p>
  {/if}

  {#if exportMut.error}
    <p class="text-danger mt-2 text-sm">{exportMut.error}</p>
  {/if}
</section>
