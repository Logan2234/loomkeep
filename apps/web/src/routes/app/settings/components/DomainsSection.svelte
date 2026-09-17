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
  import { orderedDomains, toggleDomainSelection } from "$lib/domains";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { Domain, PREMIUM_DOMAINS } from "@loomkeep/shared";
  import { dragHandle, dragHandleZone } from "svelte-dnd-action";
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

  // Tile order: settings tiles and the desktop rail's Library section both
  // read this. Drag-reordering doesn't touch enabledDomains — that array
  // stays in canonical order on purpose (toggleDomainSelection rebuilds it),
  // so this is a separate preference rather than repurposing it.
  interface DomainItem {
    id: Domain;
  }
  const items = $derived(
    orderedDomains(auth.user?.domainOrder).map((id) => ({ id })),
  );
  // Writable derived: svelte-dnd-action reassigns it mid-drag, and it
  // otherwise tracks `items` (e.g. after a save from another tab).
  let dragItems: DomainItem[] = $derived(items);

  const reorderMut = createApiMutation(() => ({
    mutate: (domainOrder: Domain[]) => updateMe({ domainOrder }),
  }));

  function handleDndConsider(e: CustomEvent<{ items: DomainItem[] }>) {
    dragItems = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: DomainItem[] }>) {
    dragItems = e.detail.items;
    reorderMut.mutate(dragItems.map((d) => d.id));
  }
</script>

{#if auth.user}
  <div
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    use:dragHandleZone={{
      items: dragItems,
      dragDisabled: reorderMut.loading,
      flipDurationMs: 150,
      type: "domain-tiles",
    }}
    onconsider={handleDndConsider}
    onfinalize={handleDndFinalize}>
    {#each dragItems as { id } (id)}
      {@const d = DOMAINS[id]}
      {@const domain = id}
      {@const on = auth.user.enabledDomains.includes(id)}
      {@const isLast = on && auth.user.enabledDomains.length === 1}
      {@const inMaintenance = liveFlags.isEnabled(`MAINTENANCE_${id}`)}
      {@const showLock =
        !on && !inMaintenance && premiumLocked && PREMIUM_DOMAINS.includes(id)}
      {#snippet domainButton()}
        <div
          id={`domain-${id}`}
          use:flashAnchor={{ anchor: `domain-${id}`, hash: page.url.hash }}
          style:--domain-color={DOMAIN_ACCENT[domain]}
          class="domain-tile border-border relative min-h-36 rounded-xl border transition-[border-color,background-color]"
          class:domain-tile-selected={on}>
          <span
            use:dragHandle
            aria-label={m.common_reorder()}
            class="text-dim hover:text-fg hover:bg-surface-2 absolute top-2 left-2 z-10 grid h-6 w-6 cursor-grab touch-none place-items-center rounded-md active:cursor-grabbing">
            <Icon name="grip" class="h-3.5 w-3.5" />
          </span>
          {#if inMaintenance}
            <span
              class="bg-surface-2 text-dim absolute -top-1.5 -right-1.5 z-10 rounded-full p-1">
              <Icon name="lock" class="h-3 w-3" />
            </span>
          {:else if d.comingSoon && !showLock}
            <span
              class="bg-surface-2 text-dim absolute -top-1.5 -right-1.5 z-10 rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold">
              {m.common_coming_soon()}
            </span>
          {/if}
          <button
            type="button"
            class="flex h-full w-full flex-col justify-between rounded-xl p-4 pt-8 text-left disabled:pointer-events-none disabled:opacity-50"
            aria-pressed={on}
            disabled={isLast || inMaintenance || showLock}
            title={inMaintenance
              ? m.settings_domain_temporarily_unavailable()
              : isLast
                ? m.settings_domain_last_required()
                : undefined}
            onclick={() => toggleDomain(id)}>
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
              {:else if (counts[id] ?? 0) > 0}
                <span class="timecode text-[0.65rem]">
                  {trackedLabel(counts[id] ?? 0)}
                </span>
              {/if}
            </span>
          </button>
        </div>
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
    {#if toggleDomainMut.error || reorderMut.error}
      <p class="text-danger text-sm sm:col-span-2 lg:col-span-3">
        {toggleDomainMut.error || reorderMut.error}
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

  /* The toggle disables itself (last domain, maintenance, locked); the tile
     itself never does (it's the drag item too) — read the button's state
     instead of the div's, which :disabled can never match. */
  .domain-tile:hover:has(button:not(:disabled)) {
    border-color: color-mix(in srgb, var(--domain-color) 45%, var(--border));
  }
</style>
