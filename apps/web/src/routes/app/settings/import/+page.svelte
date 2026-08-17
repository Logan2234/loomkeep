<script lang="ts">
  import { getImportAvailability } from "$lib/api/client";
  import Icon from "$lib/components/Icon.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { IMPORTS_DEFINITION } from "$lib/constants/import-sources";
  import { isDomainEnabled } from "$lib/domains";
  import { m } from "$lib/paraglide/messages.js";
  import type { ImportSourceDescriptor } from "$lib/types/import-descriptor";
  import {
    Domain,
    type ImportAvailabilityDto,
    type ImportSource,
  } from "@loomkeep/shared";

  const groups = Object.entries(IMPORTS_DEFINITION).reduce(
    (prev, [importType, descriptor]) => {
      if (!prev[descriptor.domain]) {
        prev[descriptor.domain] = [];
      }

      prev[descriptor.domain].push({
        ...descriptor,
        type: importType as ImportSource,
      });

      return prev;
    },
    {} as Record<Domain, (ImportSourceDescriptor & { type: ImportSource })[]>,
  );

  // A source absent from this map needs no server config of its own, so it
  // reads as available until proven otherwise — avoids flashing every
  // configured source as unavailable while the check is in flight.
  let availability = $state<ImportAvailabilityDto>({});

  $effect(() => {
    getImportAvailability()
      .then((a) => (availability = a))
      .catch(() => {});
  });
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <div class="mb-6 flex items-center gap-3">
    <a
      href="/app/settings"
      class="text-dim hover:text-fg"
      aria-label={m.common_back()}>
      <Icon name="chevron-left" class="h-5 w-5" />
    </a>
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Import
    </h1>
  </div>
  <p class="text-dim mb-8 max-w-xl text-sm">
    Récupère ton historique depuis une autre appli, par domaine.
  </p>

  <div class="flex flex-col gap-8">
    {#each Object.entries(groups) as [domain, sources] (domain)}
      {#if isDomainEnabled(domain as Domain)}
        <section>
          <p class="timecode mb-3 text-xs uppercase">
            {DOMAINS[domain as Domain].label}
          </p>
          <div class="flex flex-col gap-3">
            {#each sources as source (source.label)}
              {@const available =
                !!source.href && availability[source.type] !== false}
              {#if available}
                <a
                  href={source.href}
                  class="border-border bg-bg hover:border-accent hover:bg-surface-2 flex items-center gap-3 rounded-lg border p-4 transition-colors">
                  <Icon
                    name={DOMAINS[domain as Domain].icon}
                    class="text-accent h-6 w-6" />
                  <span class="flex-1">
                    <span class="block font-semibold">{source.label}</span>
                    <span class="text-dim text-sm">{source.description}</span>
                  </span>
                  <Icon name="chevron-right" class="text-dim h-5 w-5" />
                </a>
              {:else}
                <div
                  class="border-border bg-bg flex items-center gap-3 rounded-lg border p-4 opacity-60">
                  <Icon
                    name={DOMAINS[domain as Domain].icon}
                    class="text-dim h-6 w-6" />
                  <span class="flex-1">
                    <span class="block font-semibold">{source.label}</span>
                    <span class="text-dim text-sm">{source.description}</span>
                  </span>
                  <span
                    class="bg-surface-2 text-dim rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    {source.href ? "Indisponible" : "Bientôt"}
                  </span>
                </div>
              {/if}
            {/each}
          </div>
        </section>
      {/if}
    {/each}
  </div>
</div>
