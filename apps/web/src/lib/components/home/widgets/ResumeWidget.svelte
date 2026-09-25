<script lang="ts">
  import { listLibrary, watchEpisode } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import type { BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { LibraryEntryDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";
  import { epCode, mediaHref } from "./media";

  let { size }: { size: BoxSize } = $props();

  const def = HOME_WIDGETS.resume;
  const queryClient = useQueryClient();

  // "DORMANT" is resolved server-side — filtering the watching list here
  // would miss the shows past its first page, which are exactly the old ones.
  const dormantQuery = createApiQuery(() => ({
    key: keys.library.dormant(),
    fetch: () =>
      listLibrary({ statuses: ["DORMANT"], types: ["SERIES", "ANIME"] }).then(
        (r) => r.items,
      ),
    enabled: !!auth.user,
  }));

  // The most recently left aside first: the likeliest to be picked up again.
  const lastWatched = (e: LibraryEntryDto) =>
    e.lastWatchedAt ? new Date(e.lastWatchedAt).getTime() : 0;
  const dormant = $derived(
    [...(dormantQuery.data ?? [])].sort(
      (a, b) => lastWatched(b) - lastWatched(a),
    ),
  );

  const DAY_MS = 86_400_000;
  const pausedDays = (e: LibraryEntryDto) =>
    Math.floor((Date.now() - lastWatched(e)) / DAY_MS);

  let busy = $state<string | null>(null);

  async function resume(entry: LibraryEntryDto) {
    const next = entry.progress?.nextEpisode;
    if (!next) return;
    busy = entry.id;
    try {
      await watchEpisode(next.episodeId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.library.dormant() }),
        queryClient.invalidateQueries({ queryKey: keys.library.watching() }),
      ]);
    } catch {
      // The card stays as it was.
    } finally {
      busy = null;
    }
  }
</script>

<WidgetShell
  icon={def.icon}
  title={def.title()}
  href="/app/media"
  linkLabel={m.common_see_more()}>
  <PosterRail
    items={dormant}
    keyOf={(e) => e.id}
    info={(e) => ({
      href: mediaHref(e.mediaItem),
      title: e.mediaItem.title,
      imageUrl: e.mediaItem.posterUrl,
      subtitle: m.home_resume_paused_days({ days: pausedDays(e) }),
    })}
    {size}
    metaHeight={16}
    loading={dormantQuery.loading}
    empty={m.home_nothing_to_resume()}>
    {#snippet meta(e)}
      <p class="timecode mt-0.5 truncate text-[0.65rem]">
        {m.home_resume_paused_days({ days: pausedDays(e) })}
      </p>
    {/snippet}
    {#snippet action(e, variant)}
      {@const next = e.progress?.nextEpisode}
      {#if next}
        <button
          type="button"
          class="btn btn-primary btn-sm {variant === 'strip'
            ? 'h-6 w-full'
            : 'shrink-0'}"
          disabled={busy === e.id}
          onclick={() => resume(e)}>
          ▶ {epCode(next)}
        </button>
      {/if}
    {/snippet}
  </PosterRail>
</WidgetShell>
