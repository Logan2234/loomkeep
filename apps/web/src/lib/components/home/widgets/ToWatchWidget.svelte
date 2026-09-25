<script lang="ts">
  import {
    listLibrary,
    updateLibraryEntry,
    watchEpisode,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { bodyOf, posterLayout, type BoxSize } from "$lib/home/sizing";
  import { m } from "$lib/paraglide/messages.js";
  import type { LibraryEntryDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { tick } from "svelte";
  import PosterRail from "../PosterRail.svelte";
  import WidgetShell from "../WidgetShell.svelte";
  import { entryPct, epCode, mediaHref } from "./media";

  let { size }: { size: BoxSize } = $props();

  const def = HOME_WIDGETS.toWatch;
  const queryClient = useQueryClient();

  const watchingQuery = createApiQuery(() => ({
    key: keys.library.watching(),
    fetch: () =>
      listLibrary({ statuses: ["WATCHING"], types: ["SERIES", "ANIME"] }).then(
        (r) => r.items,
      ),
    enabled: !!auth.user,
  }));
  const plannedMoviesQuery = createApiQuery(() => ({
    key: keys.library.plannedMovies(),
    fetch: () =>
      listLibrary({ statuses: ["PLANNED"], types: ["MOVIE"] }).then(
        (r) => r.items,
      ),
    enabled: !!auth.user,
  }));

  // Most recently touched first, the in-progress shows and the movies to see
  // interleaved.
  const LIMIT = 20;
  const updatedTime = (entry: LibraryEntryDto) =>
    new Date(entry.lastWatchedAt || entry.updatedAt).getTime();
  const toWatch = $derived(
    [...(watchingQuery.data ?? []), ...(plannedMoviesQuery.data ?? [])]
      .sort((a, b) => updatedTime(b) - updatedTime(a))
      .slice(0, LIMIT),
  );

  const layout = $derived(posterLayout(bodyOf(size), { meta: 12, action: 36 }));

  let busy = $state<string | null>(null);
  let carousel = $state<{ scrollToStart: () => void }>();

  /**
   * One-click resume: marks the next unwatched episode watched, then refetches
   * just the watching list — the entry moves to the front, so the strip
   * scrolls back to keep it in view.
   */
  async function resume(entry: LibraryEntryDto) {
    const next = entry.progress?.nextEpisode;
    if (!next) return;
    busy = entry.id;
    try {
      await watchEpisode(next.episodeId);
      await queryClient.refetchQueries({ queryKey: keys.library.watching() });
      await tick();
      carousel?.scrollToStart();
    } catch {
      // The card stays as it was.
    } finally {
      busy = null;
    }
  }

  async function markMovieSeen(entry: LibraryEntryDto) {
    busy = entry.id;
    try {
      await updateLibraryEntry(entry.id, { status: "COMPLETED" });
      await queryClient.invalidateQueries({
        queryKey: keys.library.plannedMovies(),
      });
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
    bind:carousel
    items={toWatch}
    keyOf={(e) => e.id}
    info={(e) => ({
      href: mediaHref(e.mediaItem),
      title: e.mediaItem.title,
      imageUrl: e.mediaItem.posterUrl,
      subtitle: e.progress?.nextEpisode
        ? epCode(e.progress.nextEpisode)
        : undefined,
    })}
    {layout}
    loading={watchingQuery.loading || plannedMoviesQuery.loading}
    empty={m.home_nothing_to_watch()}>
    {#snippet meta(e)}
      {#if e.progress}
        <ProgressBar
          value={entryPct(e)}
          height="h-1"
          class="mt-1"
          title="{e.progress.watchedEpisodes} / {e.progress.totalEpisodes}" />
      {/if}
    {/snippet}
    {#snippet action(e, variant)}
      {@const next = e.progress?.nextEpisode}
      {#if next}
        <button
          type="button"
          class="btn btn-primary btn-sm {variant === 'strip'
            ? 'mt-2 w-full'
            : 'shrink-0'}"
          disabled={busy === e.id}
          onclick={() => resume(e)}>
          ▶ {epCode(next)}
        </button>
      {:else if e.mediaItem.type === "MOVIE"}
        <button
          type="button"
          class="btn btn-primary btn-sm {variant === 'strip'
            ? 'mt-2 w-full'
            : 'shrink-0'}"
          disabled={busy === e.id}
          onclick={() => markMovieSeen(e)}>
          {m.home_mark_seen()}
        </button>
      {/if}
    {/snippet}
  </PosterRail>
</WidgetShell>
