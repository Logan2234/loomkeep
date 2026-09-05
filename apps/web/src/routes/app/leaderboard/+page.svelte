<script lang="ts">
  // [G7] Ranking by XP — global or friends, month or year. No pagination
  // (see the ticket): the API caps the visible list at the Top 100 and
  // returns the viewer's own row separately when it falls outside that cut.
  import { getLeaderboard } from "$lib/api/gamification";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { formatNumber } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import {
    levelForXp,
    type LeaderboardEntryDto,
    type LeaderboardPeriod,
    type LeaderboardScope,
  } from "@loomkeep/shared";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";

  // Podium tint for the top 3 — a left-to-right fade, same tier colors as
  // the achievements medallions (text-tier-gold/silver/bronze). The viewer's
  // own row overrides this even at rank 1: "this is you" outranks "this is
  // gold" as the thing to notice.
  function rankTextClass(entry: LeaderboardEntryDto): string {
    if (entry.isViewer) return "text-accent";
    if (entry.rank === 1) return "text-tier-gold";
    if (entry.rank === 2) return "text-tier-silver";
    if (entry.rank === 3) return "text-tier-bronze";
    return "text-fg";
  }

  function rowClass(entry: LeaderboardEntryDto): string {
    if (entry.isViewer)
      return "bg-accent/10 shadow-[inset_2px_0_0_0_var(--color-accent)]";
    if (entry.rank === 1)
      return "bg-linear-to-r from-tier-gold/15 to-transparent hover:from-tier-gold/20";
    if (entry.rank === 2)
      return "bg-linear-to-r from-tier-silver/15 to-transparent hover:from-tier-silver/20";
    if (entry.rank === 3)
      return "bg-linear-to-r from-tier-bronze/15 to-transparent hover:from-tier-bronze/20";
    return "hover:bg-surface-2";
  }

  let scope = $state<LeaderboardScope>("global");
  let period = $state<LeaderboardPeriod>("month");

  const enabled = $derived(
    appConfig.socialEnabled && appConfig.gamificationEnabled,
  );

  const leaderboardQuery = createApiQuery(() => ({
    key: keys.gamification.leaderboard(scope, period),
    fetch: () => getLeaderboard(scope, period),
    enabled,
  }));

  const entries = $derived(leaderboardQuery.data?.entries ?? []);
  const viewerOutsideTop = $derived(
    leaderboardQuery.data?.viewerOutsideTop ?? null,
  );

  const reduced = prefersReducedMotion();
</script>

<div class="mx-auto max-w-2xl px-5 pt-6 pb-32 md:px-8 md:pt-10">
  <PageHeader
    icon="crown"
    title={m.gamification_leaderboard_title()}
    subtitle={m.gamification_leaderboard_subtitle()}
    isNew={isFeatureNew("leaderboard")} />

  {#if !enabled}
    <EmptyState>{m.gamification_leaderboard_disabled()}</EmptyState>
  {:else}
    <div class="border-border mb-5 flex gap-6 border-b">
      {#each [{ value: "global" as const, label: m.gamification_leaderboard_tab_global() }, { value: "friends" as const, label: m.gamification_leaderboard_tab_friends() }] as tab (tab.value)}
        <button
          type="button"
          class="-mb-px border-b-2 pb-2.5 text-sm font-bold {scope === tab.value
            ? 'border-accent text-fg'
            : 'text-dim border-transparent'}"
          onclick={() => (scope = tab.value)}>
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="mb-4">
      <SegmentedControl
        options={[
          {
            value: "month" as const,
            label: m.gamification_leaderboard_period_month(),
          },
          {
            value: "year" as const,
            label: m.gamification_leaderboard_period_year(),
          },
        ]}
        value={period}
        onChange={(v) => (period = v)} />
    </div>

    {#if leaderboardQuery.error}
      <Banner variant="error">{leaderboardQuery.error}</Banner>
    {:else if leaderboardQuery.loading}
      <div class="flex flex-col gap-2">
        {#each Array.from({ length: 7 }, (_, i) => i) as slot (slot)}
          <div class="skeleton h-14 rounded-xl"></div>
        {/each}
      </div>
    {:else if entries.length === 0 && !viewerOutsideTop}
      <EmptyState>{m.gamification_leaderboard_empty()}</EmptyState>
    {:else}
      <div class="card divide-border divide-y divide-dashed overflow-hidden">
        {#each entries as entry, i (entry.id)}
          <a
            href="/app/u/{entry.username}"
            class="flex items-center gap-3 px-3.5 py-2.5 {rowClass(entry)}"
            animate:flip={{ duration: reduced ? 0 : 200 }}
            in:fade|global={{ duration: reduced ? 0 : 120 }}
            out:fade|global={{ duration: reduced ? 0 : 100 }}>
            <span
              class="w-7 text-center text-lg font-bold {rankTextClass(entry)}">
              {i > 0 && entries[i - 1].rank === entry.rank ? "–" : entry.rank}
            </span>
            <Avatar seed={entry.username} url={entry.avatarUrl} size={34} />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5">
                <span class="truncate text-sm font-semibold">
                  {entry.displayName}
                </span>
                {#if entry.isViewer}
                  <span
                    class="text-accent text-[0.6rem] font-bold tracking-wide uppercase">
                    {m.gamification_leaderboard_you()}
                  </span>
                {/if}
              </span>
              <span class="text-dim block text-xs">
                {m.common_level()}
                {levelForXp(entry.xp)}
              </span>
            </span>
            <span class="timecode text-sm">
              {m.gamification_leaderboard_xp({ xp: formatNumber(entry.xp) })}
            </span>
          </a>
        {/each}
      </div>

      {#if viewerOutsideTop}
        <div
          class="border-accent bg-accent/10 mt-3 flex items-center gap-3 rounded-xl border px-3.5 py-2.5">
          <span class="text-accent w-7 text-center text-lg font-bold">
            {viewerOutsideTop.rank}
          </span>
          <Avatar
            seed={viewerOutsideTop.username}
            url={viewerOutsideTop.avatarUrl}
            size={34} />
          <span class="min-w-0 flex-1">
            <span
              class="text-accent block text-[0.6rem] font-bold tracking-wide uppercase">
              {m.gamification_leaderboard_you()}
            </span>
            <span class="truncate text-sm font-semibold">
              {viewerOutsideTop.displayName}
            </span>
          </span>
          <span class="timecode text-sm">
            {m.gamification_leaderboard_xp({
              xp: formatNumber(viewerOutsideTop.xp),
            })}
          </span>
        </div>
      {/if}
    {/if}
  {/if}
</div>
