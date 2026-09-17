<script lang="ts">
  import { getLibraryDomainCounts, updateMe } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PremiumLockBadge from "$lib/components/PremiumLockBadge.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { DOMAINS } from "$lib/constants/domains";
  import { toggleDomainSelection } from "$lib/domains";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { Domain, PREMIUM_DOMAINS } from "@loomkeep/shared";

  const premiumLocked = $derived(auth.isPremiumLocked);

  // What switching a domain off would take out of the navigation. Best
  // effort: a failed count leaves the tiles as they were rather than
  // blocking the toggles behind an error.
  const countsQuery = createApiQuery(() => ({
    key: keys.library.domainCounts(),
    fetch: getLibraryDomainCounts,
  }));
  const counts = $derived(countsQuery.data ?? {});

  function trackedLabel(count: number): string {
    return count > 1
      ? m.settings_domain_tracked_many({ count })
      : m.settings_domain_tracked_one({ count });
  }

  const toggleDomainMut = createApiMutation(() => ({
    mutate: (enabledDomains: Domain[]) => updateMe({ enabledDomains }),
  }));

  function toggleDomain(id: Domain) {
    if (!auth.user) return;
    const next = toggleDomainSelection(auth.user.enabledDomains, id);
    if (next === auth.user.enabledDomains) return; // last domain, refused
    toggleDomainMut.mutate(next);
  }
</script>

{#if auth.user}
  <section class="card p-5 md:p-6">
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {#each Object.entries(DOMAINS) as [id, d] (id)}
        {@const on = auth.user.enabledDomains.includes(id as Domain)}
        {@const isLast = on && auth.user.enabledDomains.length === 1}
        {@const inMaintenance = liveFlags.isEnabled(`MAINTENANCE_${id}`)}
        {@const showLock =
          !on &&
          !inMaintenance &&
          premiumLocked &&
          PREMIUM_DOMAINS.includes(id as Domain)}
        {#snippet domainButton()}
          <button
            type="button"
            class="border-border relative flex w-full flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors disabled:pointer-events-none disabled:opacity-50 {on
              ? 'border-accent bg-accent/10 text-fg'
              : 'text-dim hover:bg-surface-2'}"
            disabled={isLast || inMaintenance || showLock}
            title={inMaintenance
              ? m.settings_domain_temporarily_unavailable()
              : isLast
                ? m.settings_domain_last_required()
                : undefined}
            onclick={() => toggleDomain(id as Domain)}>
            {#if inMaintenance}
              <span
                class="bg-surface-2 text-dim absolute -top-1.5 -right-1.5 rounded-full p-1">
                <Icon name="lock" class="h-3 w-3" />
              </span>
            {:else if d.comingSoon && !showLock}
              <span
                class="bg-surface-2 text-dim absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold">
                {m.common_coming_soon()}
              </span>
            {/if}
            <Icon name={d.icon} class="h-5 w-5 {on ? 'text-accent' : ''}" />
            <span class="text-xs font-semibold">{d.label}</span>
            {#if countsQuery.loading && !d.comingSoon}
              <span class="skeleton h-3 w-10 rounded"></span>
            {:else if (counts[id as Domain] ?? 0) > 0}
              <span class="timecode text-[0.65rem]">
                {trackedLabel(counts[id as Domain] ?? 0)}
              </span>
            {/if}
          </button>
        {/snippet}
        {#if showLock}
          <Tooltip text={m.premium_locked()}>
            {@render domainButton()}
            <PremiumLockBadge />
          </Tooltip>
        {:else}
          {@render domainButton()}
        {/if}
      {/each}
    </div>
    {#if toggleDomainMut.error}
      <p class="text-danger mt-3 text-sm">{toggleDomainMut.error}</p>
    {/if}
  </section>
{/if}
