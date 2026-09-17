<script lang="ts">
  import { getLibraryDomainCounts, updateMe } from "$lib/api/client";
  import { page } from "$app/state";
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
  import { flashAnchor } from "../flash-anchor";

  const premiumLocked = $derived(auth.isPremiumLocked);

  // What switching a domain off would take out of the navigation. Best
  // effort: a failed count leaves the tiles as they were rather than
  // blocking the toggles behind an error.
  const countsQuery = createApiQuery(() => ({
    key: keys.library.domainCounts(),
    fetch: getLibraryDomainCounts,
  }));
  const counts = $derived(countsQuery.data ?? {});

  const DOMAIN_ACCENT: Record<Domain, string> = {
    [Domain.MEDIA]: "var(--stat-media)",
    [Domain.GAMES]: "var(--stat-games)",
    [Domain.BOOKS]: "var(--stat-books)",
    [Domain.MUSIC]: "var(--stat-music)",
    [Domain.PODCASTS]: "var(--dim)",
    [Domain.BOARDGAMES]: "var(--dim)",
  };

  const DOMAIN_DESCRIPTIONS: Record<Domain, string> = {
    [Domain.MEDIA]: m.settings_domain_media_description(),
    [Domain.GAMES]: m.settings_domain_games_description(),
    [Domain.BOOKS]: m.settings_domain_books_description(),
    [Domain.MUSIC]: m.settings_domain_music_description(),
    [Domain.PODCASTS]: m.settings_domain_podcasts_description(),
    [Domain.BOARDGAMES]: m.settings_domain_boardgames_description(),
  };

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
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each Object.entries(DOMAINS) as [id, d] (id)}
      {@const domain = id as Domain}
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
          id={`domain-${id}`}
          use:flashAnchor={{ anchor: `domain-${id}`, hash: page.url.hash }}
          style:--domain-color={DOMAIN_ACCENT[domain]}
          class="domain-tile border-border relative flex min-h-36 w-full flex-col justify-between rounded-xl border p-4 text-left transition-[border-color,background-color] disabled:pointer-events-none disabled:opacity-50"
          class:domain-tile-selected={on}
          aria-pressed={on}
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
          <Icon name={d.icon} class="domain-tile-icon h-6 w-6" />
          <span class="block">
            <span class="block text-sm font-semibold">{d.label}</span>
            <span class="text-dim mt-1 block text-xs font-normal">
              {DOMAIN_DESCRIPTIONS[domain]}
            </span>
          </span>
          <span class="text-dim block min-h-4 text-xs">
            {#if countsQuery.loading && !d.comingSoon}
              <span class="skeleton block h-3 w-12 rounded"></span>
            {:else if (counts[id as Domain] ?? 0) > 0}
              <span class="timecode text-[0.65rem]">
                {trackedLabel(counts[id as Domain] ?? 0)}
              </span>
            {/if}
          </span>
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
    {#if toggleDomainMut.error}
      <p class="text-danger text-sm sm:col-span-2 lg:col-span-3">
        {toggleDomainMut.error}
      </p>
    {/if}
  </div>
{/if}

<style>
  .domain-tile-icon {
    color: var(--domain-color);
  }

  .domain-tile-selected {
    border-color: color-mix(in srgb, var(--domain-color) 60%, var(--border));
    background: color-mix(in srgb, var(--domain-color) 11%, transparent);
  }

  .domain-tile:not(:disabled):hover {
    border-color: color-mix(in srgb, var(--domain-color) 45%, var(--border));
  }
</style>
