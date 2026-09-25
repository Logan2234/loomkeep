<script lang="ts">
  import { listGames } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { HomeWidgetDto, HomeWidgetSort } from "@loomkeep/shared";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";
  import { ENTRY_SORTS } from "./sorts";

  let { widget, size }: { widget: HomeWidgetDto; size: BoxSize } = $props();

  const def = HOME_WIDGETS.gamesPlaying;
  // A game's progress is how long it's been played.
  const SORTS: Partial<Record<HomeWidgetSort, string>> = {
    ...ENTRY_SORTS,
    progress: "playtime",
  };

  const sort = $derived(widget.config?.sort ?? "recent");
  const gamesQuery = createApiQuery(() => ({
    key: keys.games.playing(sort),
    fetch: () =>
      listGames({
        statuses: ["PLAYING"],
        sort: SORTS[sort],
      }).then((r) => r.items),
    enabled: !!auth.user,
  }));

  const hours = (minutes: number) =>
    `${Math.round(minutes / 60)} ${m.home_played_hours_suffix()}`;
</script>

<WidgetShell icon={def.icon} title={def.title()} href="/app/games">
  <PosterRail
    label={def.title()}
    items={gamesQuery.data ?? []}
    keyOf={(e) => e.id}
    info={(e) => ({
      href: `/app/games/${e.game.sourceId}`,
      title: e.game.title,
      imageUrl: e.game.coverUrl,
      subtitle: e.playtimeMinutes > 0 ? hours(e.playtimeMinutes) : undefined,
    })}
    {size}
    metaHeight={16}
    loading={gamesQuery.loading}
    empty={m.home_nothing_playing()}>
    {#snippet meta(e)}
      {#if e.playtimeMinutes > 0}
        <p class="timecode text-[0.65rem]">{hours(e.playtimeMinutes)}</p>
      {/if}
    {/snippet}
  </PosterRail>
</WidgetShell>
