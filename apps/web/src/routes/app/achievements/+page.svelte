<script lang="ts">
  // [G5] the achievements screen — own achievements only, no other user's
  // page (see the [G5] design notes: 44+ conditions together read as a
  // behavioural fingerprint). Auth comes from the app/ layout nesting.
  import { page } from "$app/state";
  import { getAchievements } from "$lib/api/gamification";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { formatNumber } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import {
    FAMILY_ORDER,
    groupAchievements,
    sectionsByFamily,
    summarize,
    type AchievementGroup,
  } from "./achievements";
  import AchievementCard from "./components/AchievementCard.svelte";
  import AchievementDrawer from "./components/AchievementDrawer.svelte";
  import AchievementsHero from "./components/AchievementsHero.svelte";
  import { familyLabel } from "./labels";

  const achievementsQuery = createApiQuery(() => ({
    key: keys.gamification.achievements(),
    fetch: getAchievements,
    enabled: appConfig.gamificationEnabled,
  }));

  const list = $derived(achievementsQuery.data ?? []);
  const summary = $derived(summarize(list));
  const sections = $derived(sectionsByFamily(groupAchievements(list)));

  // The drawer is the compact-viewport path only. Drawer.svelte is already
  // `md:hidden`, but it also locks page scroll on mount — so it must not be
  // mounted at all on a wide viewport, hence the media query rather than CSS
  // alone.
  let compact = $state(false);
  $effect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => (compact = query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  });

  let openGroup = $state<AchievementGroup | null>(null);

  // [G6] point 6: the unlock bubble deep-links here naming the achievement it
  // just announced, so the page can point at its card instead of dropping the
  // reader in front of the whole catalogue. The parameter stays in the URL —
  // the flash is a one-shot animation, so a reload simply replays it.
  const highlightKey = $derived(page.url.searchParams.get("unlocked"));
</script>

<!-- Same width container as the other app pages (see routes/app/+page.svelte):
     the layout itself constrains nothing. -->
<div class="mx-auto max-w-6xl px-5 pt-6 pb-56 md:px-8 md:pt-10 md:pb-64">
  <PageHeader
    icon="trophy"
    back="/app/profile"
    title={m.gamification_page_title()}
    subtitle={m.gamification_page_subtitle()} />

  {#if !appConfig.gamificationEnabled}
    <EmptyState>{m.gamification_disabled()}</EmptyState>
  {:else if achievementsQuery.error}
    <Banner variant="error">{achievementsQuery.error}</Banner>
  {:else if achievementsQuery.loading}
    <!-- The families are known before the data is: naming them keeps the
         page's shape while it loads, instead of a bar and a void. Counts are
         left out — those really do depend on the response. -->
    <div class="skeleton h-24 rounded-xl"></div>
    {#each FAMILY_ORDER.slice(0, 2) as family (family)}
      <div class="flex items-center gap-3 pt-8 pb-3">
        <span
          class="text-dim text-[0.65rem] font-semibold tracking-widest uppercase">
          {familyLabel(family)}
        </span>
        <span class="bg-border h-px flex-1"></span>
      </div>
      <div class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        {#each Array.from({ length: 6 }, (_, i) => i) as slot (slot)}
          <div class="skeleton h-40 rounded-xl"></div>
        {/each}
      </div>
    {/each}
  {:else if list.length === 0}
    <EmptyState>{m.gamification_empty()}</EmptyState>
  {:else}
    <AchievementsHero {summary} />

    {#each sections as section (section.family)}
      <div class="flex items-center gap-3 pt-8 pb-3">
        <span
          class="text-dim text-[0.65rem] font-semibold tracking-widest uppercase">
          {familyLabel(section.family)}
        </span>
        <span class="bg-border h-px flex-1"></span>
        <span class="timecode text-xs">
          {m.gamification_family_score({
            unlocked: formatNumber(section.unlockedEntries),
            total: formatNumber(section.totalEntries),
          })}
        </span>
      </div>

      <div class="achievement-grid grid grid-cols-2 gap-2.5 md:grid-cols-3">
        {#each section.groups as group (group.id)}
          <AchievementCard
            {group}
            highlighted={highlightKey !== null &&
              group.entries.some((entry) => entry.key === highlightKey)}
            onselect={compact ? () => (openGroup = group) : undefined} />
        {/each}
      </div>
    {/each}
  {/if}
</div>

{#if compact && openGroup}
  <AchievementDrawer group={openGroup} onclose={() => (openGroup = null)} />
{/if}

<style>
  /* Reading one card dims its family siblings, so the grid stops competing
     for attention — desktop only, where the unfold panel exists at all.
     Keyed off `:has(a hovered card)` rather than the grid's own `:hover`:
     the grid is as wide as the section even when its last row is half empty,
     and hovering that empty space used to dim everything for nothing. The
     `:not(:hover)` matters as much: `:has()` takes the specificity of its
     argument, so without it this rule outranks the one below and dims the
     card being read — panel included, letting the row beneath show through
     it. */
  @media (min-width: 768px) {
    .achievement-grid:has(> :global(.achievement-card:hover))
      > :global(.achievement-card:not(:hover)),
    .achievement-grid:has(> :global(.achievement-card:focus-visible))
      > :global(.achievement-card:not(:focus-visible)) {
      opacity: 0.4;
    }

    .achievement-grid > :global(.achievement-card:hover),
    .achievement-grid > :global(.achievement-card:focus-visible) {
      opacity: 1;
      z-index: 5;
      border-color: var(--accent);
      box-shadow: 0 18px 44px rgb(0 0 0 / 0.28);
    }
  }
</style>
