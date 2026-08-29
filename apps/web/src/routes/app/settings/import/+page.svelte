<script lang="ts">
  import { getImportAvailability, getImportQuota } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { IMPORTS_DEFINITION } from "$lib/constants/import-sources";
  import { isDomainEnabled } from "$lib/domains";
  import { isFeatureNew } from "$lib/feature-badges";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ImportSourceDescriptor } from "$lib/types/import-descriptor";
  import {
    Domain,
    type ImportAvailabilityDto,
    type ImportQuotaDto,
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
  // configured source as unavailable while the check is in flight (or on
  // a failed check — best-effort, no errorToast).
  const availabilityQuery = createApiQuery(() => ({
    key: keys.import.availability(),
    fetch: getImportAvailability,
  }));
  const quotaQuery = createApiQuery(() => ({
    key: keys.import.quota(),
    fetch: getImportQuota,
  }));
  const availability = $derived<ImportAvailabilityDto>(
    availabilityQuery.data ?? {},
  );
  const quota = $derived<ImportQuotaDto>(quotaQuery.data ?? {});

  const premiumLocked = $derived(
    liveFlags.isEnabled("premium-features") && !auth.isPremium,
  );
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
        {@const usedUp = premiumLocked && quota[domain as Domain] === true}
        <section>
          <p class="timecode mb-3 flex items-center gap-2 text-xs uppercase">
            {DOMAINS[domain as Domain].label}
            {#if premiumLocked && !usedUp}
              <span
                class="bg-surface-2 text-dim rounded-full px-2 py-0.5 text-[0.65rem] font-semibold normal-case">
                {m.import_free_quota()}
              </span>
            {/if}
          </p>
          <div class="flex flex-col gap-3">
            {#each sources as source (source.label)}
              {@const available =
                !!source.href && availability[source.type] !== false && !usedUp}
              {#if available}
                <a
                  href={source.href}
                  class="border-border bg-bg hover:border-accent hover:bg-surface-2 flex items-center gap-3 rounded-lg border p-4 transition-colors">
                  <Icon
                    name={DOMAINS[domain as Domain].icon}
                    class="text-accent h-6 w-6" />
                  <span class="flex-1">
                    <span class="flex items-center gap-2 font-semibold">
                      {source.label}
                      {#if source.newBadgeKey && isFeatureNew(source.newBadgeKey)}
                        <NewBadge />
                      {/if}
                    </span>
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
                    <span class="flex items-center gap-2 font-semibold">
                      {source.label}
                      {#if source.newBadgeKey && isFeatureNew(source.newBadgeKey)}
                        <NewBadge />
                      {/if}
                    </span>
                    <span class="text-dim text-sm">{source.description}</span>
                  </span>
                  {#if usedUp}
                    <Tooltip text={m.import_free_quota_used()}>
                      <span
                        class="bg-accent text-accent-fg inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        <Icon name="lock" class="h-3 w-3" />
                        {m.common_premium()}
                      </span>
                    </Tooltip>
                  {:else}
                    <span
                      class="bg-surface-2 text-dim rounded-full px-2.5 py-0.5 text-xs font-semibold">
                      {source.href
                        ? m.common_unavailable()
                        : m.landing_libraries_soon()}
                    </span>
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        </section>
      {/if}
    {/each}
  </div>
</div>
