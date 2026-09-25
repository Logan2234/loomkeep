<script lang="ts">
  import { getLeaderboard } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import { formatNumber } from "$lib/format";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { m } from "$lib/paraglide/messages.js";
  import type { LeaderboardEntryDto } from "@loomkeep/shared";
  import WidgetShell from "../WidgetShell.svelte";

  const def = HOME_WIDGETS.friendsPodium;

  // Same cache entry as the leaderboard's "Amis · Ce mois-ci" tab.
  const boardQuery = createApiQuery(() => ({
    key: keys.gamification.leaderboard("friends", "month"),
    fetch: () => getLeaderboard("friends", "month"),
  }));
  const top = $derived((boardQuery.data?.entries ?? []).slice(0, 3));
  // The viewer's own line, when they're ranked but not on the podium.
  const viewer = $derived.by((): LeaderboardEntryDto | null => {
    const board = boardQuery.data;
    if (!board) return null;
    if (board.viewerOutsideTop) return board.viewerOutsideTop;
    const self = board.entries.find((e) => e.isViewer);
    return self && self.rank > 3 ? self : null;
  });

  // Second, first, third: the winner stands in the middle, highest.
  const STEPS: { place: number; height: string }[] = [
    { place: 1, height: "h-10" },
    { place: 0, height: "h-14" },
    { place: 2, height: "h-7" },
  ];
</script>

<WidgetShell
  icon={def.icon}
  title={def.title()}
  href="/app/leaderboard"
  linkLabel={m.common_see()}>
  {#if boardQuery.loading}
    <div class="flex h-full items-end justify-center gap-3">
      {#each STEPS as step (step.place)}
        <div class="skeleton w-14 rounded-t-md {step.height}"></div>
      {/each}
    </div>
  {:else if top.length > 0}
    <div class="flex h-full flex-col">
      <ol class="flex min-h-0 flex-1 items-end justify-center gap-2">
        {#each STEPS as step (step.place)}
          {@const entry = top[step.place]}
          <li class="flex w-1/3 max-w-24 min-w-0 flex-col items-center">
            {#if entry}
              <Avatar
                seed={entry.username}
                url={entry.avatarUrl}
                size={step.place === 0 ? 44 : 36} />
              <p
                class="mt-1 w-full truncate text-center text-xs font-semibold {entry.isViewer
                  ? 'text-accent'
                  : ''}">
                {entry.displayName}
              </p>
              <p class="timecode text-[0.65rem]">
                {m.home_podium_xp({ xp: formatNumber(entry.xp) })}
              </p>
              <div
                class="border-accent/40 mt-1 flex w-full items-start justify-center rounded-t-md border border-b-0 pt-1 {step.place ===
                0
                  ? 'bg-accent/20'
                  : 'bg-surface-2'} {step.height}">
                <span class="timecode text-accent text-xs font-bold">
                  {entry.rank}
                </span>
              </div>
            {/if}
          </li>
        {/each}
      </ol>
      {#if viewer}
        <p
          class="border-border text-dim mt-2 shrink-0 border-t pt-2 text-center text-xs">
          {m.home_podium_viewer({
            rank: viewer.rank,
            xp: formatNumber(viewer.xp),
          })}
        </p>
      {/if}
    </div>
  {:else}
    <p
      class="text-dim flex h-full items-center justify-center text-center text-sm">
      {m.home_podium_empty()}
    </p>
  {/if}
</WidgetShell>
