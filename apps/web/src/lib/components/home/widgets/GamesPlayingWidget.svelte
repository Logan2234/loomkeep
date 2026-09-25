<script lang="ts">
  import { listGames } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";

  let { size }: { size: BoxSize } = $props();

  const def = HOME_WIDGETS.gamesPlaying;

  const gamesQuery = createApiQuery(() => ({
    key: keys.games.playing(),
    fetch: () => listGames({ statuses: ["PLAYING"] }).then((r) => r.items),
    enabled: !!auth.user,
  }));

  const hours = (minutes: number) =>
    `${Math.round(minutes / 60)} ${m.home_played_hours_suffix()}`;
</script>

<WidgetShell icon={def.icon} title={def.title()} href="/app/games">
  <PosterRail
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
