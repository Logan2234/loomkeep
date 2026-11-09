<script lang="ts">
  import { episodeCode } from "@loomkeep/shared";

  import {
    batchEpisodeWatches,
    getSeasonImages,
    undoEpisodeWatches,
    unwatchEpisode,
    unwatchSeason,
    updateLibraryEntry,
    watchEpisode,
    watchSeason,
    watchThrough,
  } from "#lib/api/client.js";
  import { resolveApiError } from "#lib/api/errors.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { longpress } from "#lib/actions/longpress.js";
  import { onBackPress } from "#lib/back-press.js";
  import ConfirmationModal from "#lib/components/ConfirmationModal.svelte";
  import Lightbox from "#lib/components/Lightbox.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import ReviewsSection from "#lib/components/ReviewsSection.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { formatNumber } from "#lib/format.js";
  import { layout } from "#lib/layout.svelte.js";
  import { tapFeedback } from "#lib/native/haptics.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { listenTabSwipe } from "#lib/tab-swipe.js";
  import { toast } from "#lib/toast.svelte.js";
  import { useQueryClient } from "@tanstack/svelte-query";
  import type {
    EpisodeWatchBatchAction,
    EpisodeWatchRestoreDto,
    LibraryEntryDto,
    MediaDetailEpisodeDto,
    MediaDetailSeasonDto,
    MediaType,
    ReviewTargetType,
  } from "@loomkeep/shared";
  import { tick, untrack } from "svelte";
  import { fly } from "svelte/transition";
  import { upcomingLabel } from "./episode-format";
  import { followRangeDrag } from "./episode-range-drag";
  import EpisodePanel from "./EpisodePanel.svelte";
  import EpisodeRow from "./EpisodeRow.svelte";
  import {
    announcedEpisode,
    arrivalTabKey,
    asksRewatch,
    episodeTabs,
    isAired,
    largeTmdbImage,
    playlist,
    runProgress,
    selectionActions,
    selectionRange,
    selectionSpan,
    tabKeyOf,
    unwatchedGapCount,
    upNextEpisode,
    type EpisodeTab,
  } from "./episodes";
  import GoToEpisode from "./GoToEpisode.svelte";
  import SeasonHeader from "./SeasonHeader.svelte";
  import SeasonTabs from "./SeasonTabs.svelte";
  import SelectionBar from "./SelectionBar.svelte";
  import UpNextBar from "./UpNextBar.svelte";

  const reduced = prefersReducedMotion();

  let {
    seasons,
    entry,
    mediaType,
    sourceId,
    reload,
    onError,
  }: {
    seasons: MediaDetailSeasonDto[];
    entry: LibraryEntryDto | null;
    mediaType: MediaType;
    /** The route's catalogue id (TMDB for a series, AniList for an anime). */
    sourceId: string;
    reload: () => Promise<void>;
    onError: (message: string) => void;
  } = $props();

  // Anime air dates are exact broadcast times (AniList's schedule).
  const exactTime = $derived(mediaType === "ANIME");
  const tmdbSourceId = $derived(mediaType === "SERIES" ? sourceId : null);

  // "Now" for aired/upcoming checks, kept current while the page stays open.
  let now = $state(new Date());
  $effect(() => {
    const timer = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(timer);
  });

  const markWatchedMut = createApiMutation(() => ({
    mutate: (episodeId: string) => watchEpisode(episodeId),
    onSuccess: async (_data, episodeId) => {
      const seenBefore = seasons.some((s) =>
        s.episodes.some((e) => e.id === episodeId && e.watchCount > 0),
      );
      const ask = asksRewatch(entry, seenBefore);
      await reload();
      popCheck(episodeId);
      if (ask) rewatchPrompt = { count: 1 };
    },
    onError: (err) => onError(resolveApiError(err)),
  }));
  const markUnwatchMut = createApiMutation(() => ({
    mutate: (episodeId: string) => unwatchEpisode(episodeId),
    onSuccess: () => reload(),
    onError: (err) => onError(resolveApiError(err)),
  }));
  const confirmCatchupYesMut = createApiMutation(() => ({
    mutate: (episodeId: string) => watchThrough(episodeId),
    onSuccess: async () => {
      await reload();
      tapFeedback();
    },
    onError: (err) => onError(resolveApiError(err)),
  }));
  const markSeasonMut = createApiMutation(() => ({
    mutate: (seasonId: string) => watchSeason(seasonId),
    onSuccess: async () => {
      await reload();
      tapFeedback();
    },
    onError: (err) => onError(resolveApiError(err)),
  }));
  const confirmUnwatchSeasonMut = createApiMutation(() => ({
    mutate: (seasonId: string) => unwatchSeason(seasonId),
    onSuccess: async () => {
      await reload();
      confirmUnwatchSeasonId = null;
    },
    onError: (err) => onError(resolveApiError(err)),
  }));

  const batchMut = createApiMutation(() => ({
    mutate: ({
      action,
      ids,
    }: {
      action: EpisodeWatchBatchAction;
      ids: string[];
      /** Every viewing of one episode, from its "Watched" menu. */
      single?: { code: string; count: number };
    }) => batchEpisodeWatches(action, ids),
    onSuccess: async (result, { action, single }) => {
      const ask = action === "rewatch" && asksRewatch(entry, true);
      exitSelection();
      await reload();
      tapFeedback();
      const touched =
        action === "unwatch"
          ? new Set(result.removed.map((r) => r.episodeId)).size
          : result.created.length;
      offerUndo(
        single ? m.media_watches_undone(single) : bulkMessage(action, touched),
        action === "unwatch"
          ? { restore: result.removed }
          : { deleteWatchIds: result.created.map((w) => w.id) },
      );
      if (ask && touched > 0) rewatchPrompt = { count: touched };
    },
    onError: (err) => onError(resolveApiError(err)),
  }));
  const undoMut = createApiMutation(() => ({
    mutate: (body: {
      deleteWatchIds?: string[];
      restore?: EpisodeWatchRestoreDto[];
    }) => undoEpisodeWatches(body),
    onSuccess: async () => {
      await reload();
      toast.success(m.media_action_undone(), 2000);
    },
    onError: (err) => onError(resolveApiError(err)),
  }));

  // Seeing a finished show's episode again: is the whole show being rewatched?
  let rewatchPrompt = $state<{ count: number } | null>(null);
  const startRewatchMut = createApiMutation(() => ({
    mutate: () => updateLibraryEntry(entry!.id, { rewatching: true }),
    onSuccess: async () => {
      rewatchPrompt = null;
      await reload();
    },
    onError: (err) => onError(resolveApiError(err)),
  }));

  const UNDO_MS = 5000;

  function offerUndo(
    message: string,
    body: {
      deleteWatchIds?: string[];
      restore?: EpisodeWatchRestoreDto[];
    },
  ) {
    toast.action(
      message,
      { label: m.common_cancel(), onSelect: () => undoMut.mutate(body) },
      "info",
      UNDO_MS,
    );
  }

  function bulkMessage(action: EpisodeWatchBatchAction, count: number): string {
    if (action === "watch") {
      return count === 1
        ? m.media_bulk_watched_one()
        : m.media_bulk_watched({ count });
    }
    if (action === "rewatch") {
      return count === 1
        ? m.media_bulk_rewatched_one()
        : m.media_bulk_rewatched({ count });
    }
    return count === 1
      ? m.media_bulk_unwatched_one()
      : m.media_bulk_unwatched({ count });
  }

  /** Whether any in-flight mutation targets this episode — drives its buttons' disabled state. */
  function episodeBusy(episodeId: string): boolean {
    return (
      (markWatchedMut.loading && markWatchedMut.variables === episodeId) ||
      (markUnwatchMut.loading && markUnwatchMut.variables === episodeId) ||
      (confirmCatchupYesMut.loading &&
        confirmCatchupYesMut.variables === episodeId)
    );
  }

  const seasonLabel = (season: MediaDetailSeasonDto) =>
    season.title ?? `${m.common_season()} ${season.number}`;
  const episodeTitle = (episode: MediaDetailEpisodeDto) =>
    episode.title ?? `${m.common_episode()} ${episode.number}`;

  // Only the open tab's rows exist: at most 100 on a cut anime.
  const tabs = $derived(episodeTabs(seasons));
  const sliced = $derived(tabs.some((t) => t.range));
  let activeKey = $state<string | null>(
    untrack(() =>
      arrivalTabKey(episodeTabs(seasons), seasons, !!entry, new Date()),
    ),
  );
  const activeIndex = $derived(tabs.findIndex((t) => t.key === activeKey));
  const activeTab = $derived(tabs[activeIndex] ?? tabs[0] ?? null);
  const current = $derived(
    seasons.find((s) => s.number === activeTab?.seasonNumber) ?? null,
  );
  /** The season a cut show's single card speaks for, above its tabs. */
  const cutSeason = $derived(
    sliced
      ? (seasons.find(
          (s) => s.number === tabs.find((t) => t.range)?.seasonNumber,
        ) ?? null)
      : null,
  );
  // Which way the next page arrives from.
  let direction = $state(1);

  const tabPageLabel = (tab: EpisodeTab) => {
    const season = seasons.find((s) => s.number === tab.seasonNumber);
    return tab.range || !season ? tabTitle(tab) : seasonLabel(season);
  };
  const tabTitle = (tab: EpisodeTab) => {
    if (tab.range) {
      return `${tab.range.from}–${tab.range.to}`;
    }
    const season = seasons.find((s) => s.number === tab.seasonNumber);
    return tab.seasonNumber === 0 && season
      ? seasonLabel(season)
      : `S${tab.seasonNumber}`;
  };

  let tabsEl = $state<HTMLElement>();
  let pagesEl = $state<HTMLElement>();
  let listEl = $state<HTMLElement>();

  /** Changes page; if the list was scrolled under the tabs, they stay on top. */
  function showTab(key: string) {
    const to = tabs.findIndex((t) => t.key === key);
    if (to < 0 || key === activeKey) return;
    direction = to >= activeIndex ? 1 : -1;
    activeKey = key;
    void tick().then(() => {
      if (!tabsEl || !pagesEl) return;
      const overlap =
        tabsEl.getBoundingClientRect().bottom -
        pagesEl.getBoundingClientRect().top;
      if (overlap > 0) window.scrollBy?.(0, -overlap);
    });
  }

  function stepTab(step: -1 | 1) {
    const next = tabs[activeIndex + step];
    if (next) showTab(next.key);
  }

  // The sticky tabs sit under the page's own sticky action bar, whose height
  // changes as it wraps.
  let actionBarHeight = $state(0);
  $effect(() => {
    const bar = document.querySelector<HTMLElement>("[data-action-bar]");
    if (!bar) return;
    const observer = new ResizeObserver(() => {
      actionBarHeight = bar.offsetHeight;
    });
    observer.observe(bar);
    return () => observer.disconnect();
  });

  // Sliding sideways changes page, the page under the finger until released.
  let followingEl = $state<HTMLElement>();
  $effect(() => {
    const pages = pagesEl;
    if (!pages) return;
    return listenTabSwipe(
      pages,
      (step) => {
        if (!stopDrag) stepTab(step);
      },
      {
        targets: () => (followingEl && !stopDrag ? [followingEl] : []),
        canStep: (step) => !!tabs[activeIndex + step],
      },
    );
  });

  // A season's posters, in a lightbox from its own poster (TMDB only): the
  // one shown first, then the rest once fetched.
  let posterLightbox = $state<number | null>(null);
  const seasonImagesQuery = createApiQuery(() => ({
    key: keys.media.seasonImages(tmdbSourceId ?? "", posterLightbox ?? -1),
    fetch: () => getSeasonImages(tmdbSourceId!, posterLightbox!),
    enabled: !!tmdbSourceId && posterLightbox !== null,
    retry: 0,
  }));
  const posterImages = $derived.by(() => {
    const season = seasons.find((s) => s.number === posterLightbox);
    if (!season?.posterUrl) return [];
    const fileOf = (url: string) => url.slice(url.lastIndexOf("/"));
    const main = largeTmdbImage(season.posterUrl);
    const rest = (seasonImagesQuery.data?.images ?? []).filter(
      (url) => fileOf(url) !== fileOf(main),
    );
    return [main, ...rest].map((src) => ({ src, alt: seasonLabel(season) }));
  });

  let highlightedEpisode = $state<string | null>(null);

  /** Opens the episode's tab and brings its row into view, lit for a moment. */
  function goToEpisode(seasonNumber: number, episodeNumber: number) {
    const key = tabKeyOf(tabs, seasonNumber, episodeNumber);
    if (key) showTab(key);
    const row = `s${seasonNumber}e${episodeNumber}`;
    void tick().then(() => {
      document.getElementById(`episode-${row}`)?.scrollIntoView?.({
        behavior: reduced ? "auto" : "smooth",
        block: "center",
      });
      highlightedEpisode = row;
      setTimeout(() => (highlightedEpisode = null), 2000);
    });
  }

  // `#s2e5`: an episode code in a message links here.
  $effect(() => {
    const target = /^#s(\d+)e(\d+)$/i.exec(window.location.hash);
    if (!target) return;
    untrack(() => goToEpisode(Number(target[1]), Number(target[2])));
  });

  let goToOpen = $state(false);

  // The episode whose side panel is open.
  let openEpisode = $state<{ season: number; episode: number } | null>(null);
  const panel = $derived.by(() => {
    if (!openEpisode) return null;
    const { season: sn, episode: en } = openEpisode;
    const season = seasons.find((s) => s.number === sn);
    const episode = season?.episodes.find((e) => e.number === en);
    if (!season || !episode) return null;
    // Previous/next walk the whole run: past a season's last episode comes
    // the next season's first.
    const run = playlist(seasons, sn);
    const at = run.findIndex((p) => p.season === sn && p.episode === en);
    return { season, episode, before: run[at - 1], after: run[at + 1] };
  });

  /** Opens an episode's panel, the list following it into its season. */
  function openPanel(target: { season: number; episode: number }) {
    openEpisode = target;
    const key = tabKeyOf(tabs, target.season, target.episode);
    if (key) showTab(key);
  }

  const queryClient = useQueryClient();

  /** A comment posted from its details has to reach the row's counter. */
  function closePanel() {
    const id = panel?.episode.id;
    const shown = panel?.episode.commentCount;
    openEpisode = null;
    if (!id) return;
    const count = queryClient.getQueryData<{ count: number }>(
      keys.comments.count("EPISODE", id),
    );
    if (count && count.count !== shown) void reload();
  }

  let confirmUnwatchSeasonId = $state<string | null>(null);

  // "Marquer vu" on an episode with unwatched episodes before it asks first —
  // declining once means we stop asking for the rest of this page view
  // (component instance), not persisted beyond that.
  let catchup = $state<{ episodeId: string; count: number } | null>(null);
  let declinedCatchup = $state(false);

  // A season's or episode's own review opens in a modal, never inline.
  let reviewTarget = $state<{
    type: ReviewTargetType;
    id: string;
    label: string;
  } | null>(null);

  function closeReview() {
    reviewTarget = null;
    // Its rating feeds the counts and averages shown here.
    void reload();
  }

  const seasonWatchedCount = (season: MediaDetailSeasonDto) =>
    season.episodes.filter((e) => e.seen).length;
  const seasonWatched = (season: MediaDetailSeasonDto) =>
    season.episodes.length > 0 && season.episodes.every((ep) => ep.seen);

  // Which season just crossed into "fully watched", cleared on its own. Keyed
  // by number rather than a boolean so re-finishing another season while the
  // first is still showing swaps the message instead of stacking.
  const FINISHED_MS = 2600;
  let justFinished = $state<number | null>(null);
  let watchedBefore = new Map<number, boolean>();
  $effect(() => {
    for (const season of seasons) {
      const done = seasonWatched(season);
      const was = watchedBefore.get(season.number);
      watchedBefore.set(season.number, done);
      if (was === false && done) justFinished = season.number;
    }
  });
  $effect(() => {
    if (justFinished === null) return;
    const timer = setTimeout(() => (justFinished = null), FINISHED_MS);
    return () => clearTimeout(timer);
  });

  const progress = $derived(runProgress(seasons, now));
  const progressLabel = $derived(
    progress.watched === 0
      ? m.media_episodes_not_started()
      : progress.watched >= progress.aired
        ? m.media_episodes_up_to_date()
        : m.media_episodes_progress(progress),
  );

  // Ticks land when an episode is marked — gated on "the episode that was
  // just marked" so a page load doesn't pop every tick already there.
  // Long enough for the row's reward animation (EpisodeRow) to play out.
  const CHECK_POP_MS = 600;
  let justWatchedId = $state<string | null>(null);

  function popCheck(episodeId: string) {
    justWatchedId = episodeId;
    tapFeedback();
    setTimeout(() => {
      if (justWatchedId === episodeId) justWatchedId = null;
    }, CHECK_POP_MS);
  }

  function markWatched(episodeId: string) {
    onError("");
    markWatchedMut.mutate(episodeId);
  }

  /**
   * Entry point for every "Marquer vu" — asks first if it would silently
   * skip over earlier unwatched episodes. Whether it went straight through.
   */
  function requestMarkWatched(
    seasonNumber: number,
    episodeNumber: number,
    episodeId: string,
  ): boolean {
    const gap = unwatchedGapCount(seasons, seasonNumber, episodeNumber);
    if (gap > 0 && !declinedCatchup) {
      catchup = { episodeId, count: gap };
      return false;
    }
    markWatched(episodeId);
    return true;
  }

  function confirmCatchupYes() {
    if (!catchup) return;
    const episodeId = catchup.episodeId;
    catchup = null;
    onError("");
    confirmCatchupYesMut.mutate(episodeId);
  }

  function confirmCatchupNo() {
    if (!catchup) return;
    const episodeId = catchup.episodeId;
    declinedCatchup = true;
    catchup = null;
    markWatched(episodeId);
  }

  function markSeason(seasonId: string) {
    onError("");
    markSeasonMut.mutate(seasonId);
  }

  function confirmUnwatchSeason() {
    if (!confirmUnwatchSeasonId) return;
    onError("");
    confirmUnwatchSeasonMut.mutate(confirmUnwatchSeasonId);
  }

  function markUnwatch(episodeId: string) {
    onError("");
    markUnwatchMut.mutate(episodeId);
  }

  const nextUp = $derived(entry ? upNextEpisode(seasons, entry, now) : null);
  const announced = $derived(
    entry && !nextUp ? announcedEpisode(seasons, now) : null,
  );
  const barEpisode = $derived(nextUp ?? announced);

  // Selection: survives changing tabs, gone with the mode.
  let selecting = $state(false);
  let selected = $state.raw<ReadonlySet<string>>(new Set());
  let lastToggled: string | null = null;
  let selectionBarEl = $state<HTMLElement>();

  const episodesById = $derived(
    new Map(
      seasons.flatMap((s) =>
        s.episodes.flatMap((e) => (e.id ? [[e.id, e] as const] : [])),
      ),
    ),
  );
  const selectedEpisodes = $derived(
    [...selected].flatMap((id) => episodesById.get(id) ?? []),
  );
  const actions = $derived(selectionActions(selectedEpisodes, now));
  const spanLabel = $derived.by(() => {
    const span = selectionSpan(tabs, selected, now);
    if (!span) return "";
    if ("sliced" in span) {
      return span.sliced
        ? m.media_selection_slices({ count: span.tabs })
        : m.media_selection_seasons({ count: span.tabs });
    }
    if (!span.contiguous) return "";
    const first = episodeCode(span.seasonNumber, span.first);
    return span.first === span.last
      ? first
      : `${first} → ${episodeCode(span.seasonNumber, span.last)}`;
  });

  function exitSelection() {
    stopDrag?.();
    stopDrag = null;
    selecting = false;
    selected = new Set();
    lastToggled = null;
  }

  $effect(() => {
    return selecting ? onBackPress(exitSelection) : undefined;
  });

  function toggleEpisode(id: string, shiftKey: boolean) {
    if (shiftKey && lastToggled && activeTab) {
      selected = new Set([
        ...selected,
        ...selectionRange(activeTab.episodes, lastToggled, id, now),
      ]);
    } else {
      const next = new Set(selected);
      if (!next.delete(id)) next.add(id);
      selected = next;
    }
    selecting = true;
    lastToggled = id;
  }

  // A held row enters the mode; sliding without lifting ticks the whole range
  // from it. What was ticked before the gesture stays ticked.
  let stopDrag: (() => void) | null = $state(null);

  function startRangeDrag(pressed: HTMLElement) {
    const anchor = pressed.dataset.episodeRow;
    const list = listEl;
    if (!anchor || !list) return;
    const before = selected;
    const extend = (id: string) => {
      if (!activeTab) return;
      selected = new Set([
        ...before,
        ...selectionRange(activeTab.episodes, anchor, id, now),
      ]);
      lastToggled = id;
    };
    selecting = true;
    extend(anchor);
    stopDrag = followRangeDrag({
      list,
      edges: () => ({
        top: tabsEl?.getBoundingClientRect().bottom ?? 0,
        bottom:
          selectionBarEl?.getBoundingClientRect().top ?? window.innerHeight,
      }),
      rowAt: (target) =>
        target.closest<HTMLElement>("[data-episode-row]")?.dataset.episodeRow ??
        null,
      onOver: extend,
      onEnd: () => (stopDrag = null),
    });
  }

  // Must be listening before the gesture starts: only then may it stop the
  // page scrolling under a finger that's ticking rows.
  $effect(() => {
    const list = listEl;
    if (!list) return;
    const hold = (e: TouchEvent) => {
      if (stopDrag && e.cancelable) e.preventDefault();
    };
    list.addEventListener("touchmove", hold, { passive: false });
    return () => list.removeEventListener("touchmove", hold);
  });

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && selecting && !e.defaultPrevented) exitSelection();
  }

  const sheetOpen = $derived(
    !!openEpisode ||
      !!catchup ||
      !!confirmUnwatchSeasonId ||
      !!reviewTarget ||
      goToOpen ||
      posterLightbox !== null,
  );

  // The bars sit over the page's end: everything leaves them room (main's
  // padding, the toast above them).
  let floatingHeight = $state(0);
  $effect(() => {
    if (!layout.compact || floatingHeight === 0) return;
    const root = document.documentElement.style;
    root.setProperty("--floating-bar-space", `${floatingHeight + 16}px`);
    return () => root.removeProperty("--floating-bar-space");
  });

  function reviewEpisode(
    season: MediaDetailSeasonDto,
    episode: MediaDetailEpisodeDto,
  ) {
    if (!episode.id) return;
    reviewTarget = {
      type: "EPISODE",
      id: episode.id,
      label: episodeCode(season.number, episode.number),
    };
  }

  function neighbour(target: { season: number; episode: number } | undefined) {
    if (!target) return null;
    const episode = seasons
      .find((s) => s.number === target.season)
      ?.episodes.find((e) => e.number === target.episode);
    if (!episode) return null;
    return {
      code: episodeCode(target.season, target.episode),
      title: episodeTitle(episode),
      go: () => openPanel(target),
    };
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<h2
  class="font-display mt-10 mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xl font-bold">
  {m.media_episodes()}
  {#if isFeatureNew("episode-details") || (entry && isFeatureNew("episode-selection"))}<NewBadge />{/if}
  {#if entry}
    <span class="text-dim font-sans text-sm font-medium">{progressLabel}</span>
  {/if}
</h2>

{#snippet seasonCard(season: MediaDetailSeasonDto)}
  {@const seasonId = season.id}
  <SeasonHeader
    {season}
    title={seasonLabel(season)}
    tracked={!!entry}
    {exactTime}
    canOpenPosters={!!tmdbSourceId}
    watchedCount={seasonWatchedCount(season)}
    hasPending={season.episodes.some((e) => e.id && !e.seen && isAired(e, now))}
    finished={justFinished === season.number}
    allWatched={seasonWatched(season)}
    marking={markSeasonMut.loading && markSeasonMut.variables === seasonId}
    onPosters={() => (posterLightbox = season.number)}
    onReview={() =>
      seasonId &&
      (reviewTarget = {
        type: "SEASON",
        id: seasonId,
        label: seasonLabel(season),
      })}
    onMark={() => seasonId && markSeason(seasonId)}
    onUndo={() => (confirmUnwatchSeasonId = seasonId)} />
{/snippet}

{#if cutSeason}
  <div class="mb-3">{@render seasonCard(cutSeason)}</div>
{/if}

<!-- Scopes what sticks: the tabs and the bar leave with the list. -->
<div>
  <div
    bind:this={tabsEl}
    class="bg-bg sticky z-15 -mx-1 px-1 py-1.5"
    style="top: calc(env(safe-area-inset-top) + {actionBarHeight}px)">
    <SeasonTabs
      {tabs}
      active={activeTab?.key ?? null}
      tracked={!!entry}
      {selected}
      title={tabTitle}
      onSelect={showTab}
      onGoTo={sliced ? () => (goToOpen = true) : undefined} />
  </div>

  {#if activeTab}
    {@const tab = activeTab}
    {@const before = tabs[activeIndex - 1]}
    {@const after = tabs[activeIndex + 1]}
    <div
      bind:this={pagesEl}
      class="touch-pan-y pt-2"
      role="tabpanel"
      aria-label={tabTitle(tab)}>
      <div bind:this={followingEl}>
        {#key tab.key}
          <div
            in:fly={{
              x: reduced ? 0 : direction * 28,
              duration: reduced ? 0 : 200,
            }}>
            {#if tab.range}
              <p class="mb-2 flex items-baseline justify-between gap-3 px-1">
                <span class="text-sm font-semibold">
                  {m.media_episodes_range({
                    from: formatNumber(tab.range.from),
                    to: formatNumber(tab.range.to),
                  })}
                </span>
                {#if entry}
                  <span class="timecode text-dim text-xs">
                    {m.media_watched_of({
                      watched: tab.episodes.filter((e) => e.seen).length,
                      total: tab.episodes.length,
                    })}
                  </span>
                {/if}
              </p>
            {:else if current}
              <div class="mb-3">{@render seasonCard(current)}</div>
            {/if}

            <ul
              bind:this={listEl}
              class="card mb-4 overflow-hidden"
              use:longpress={{
                enabled: !!entry,
                // The action column holds a menu, whose backdrop covers the page.
                pick: (target) =>
                  target.closest("[data-row-actions]")
                    ? null
                    : target.closest<HTMLElement>("[data-episode-row]"),
                onLongPress: startRangeDrag,
              }}>
              {#each tab.episodes as episode (episode.number)}
                {@const episodeId = episode.id}
                {@const seasonNumber = tab.seasonNumber}
                {@const code = episodeCode(seasonNumber, episode.number)}
                <EpisodeRow
                  {episode}
                  {seasonNumber}
                  {code}
                  {exactTime}
                  rewatching={!!entry?.rewatching}
                  tracked={!!entry}
                  {now}
                  selected={openEpisode?.season === seasonNumber &&
                    openEpisode.episode === episode.number}
                  highlighted={highlightedEpisode ===
                    `s${seasonNumber}e${episode.number}`}
                  justWatched={!!episodeId && justWatchedId === episodeId}
                  busy={!!episodeId && episodeBusy(episodeId)}
                  isNext={nextUp?.seasonNumber === seasonNumber &&
                    nextUp.episode.number === episode.number}
                  {selecting}
                  checked={!!episodeId && selected.has(episodeId)}
                  onOpen={() =>
                    openEpisode?.season === seasonNumber &&
                    openEpisode.episode === episode.number
                      ? closePanel()
                      : openPanel({
                          season: seasonNumber,
                          episode: episode.number,
                        })}
                  onMark={() =>
                    episodeId &&
                    requestMarkWatched(seasonNumber, episode.number, episodeId)}
                  onRewatch={() => episodeId && markWatched(episodeId)}
                  onUndo={() => episodeId && markUnwatch(episodeId)}
                  onUndoAll={() =>
                    episodeId &&
                    batchMut.mutate({
                      action: "unwatch",
                      ids: [episodeId],
                      single: { code, count: episode.watchCount },
                    })}
                  onToggle={(shiftKey) =>
                    episodeId && toggleEpisode(episodeId, shiftKey)} />
              {/each}
            </ul>

            {#if before || after}
              <nav class="mb-4 flex gap-2">
                {#if before}
                  <button
                    type="button"
                    class="border-border bg-surface hover:bg-surface-2 min-w-0 flex-1 rounded-xl border px-3 py-2 text-left transition-colors duration-150"
                    onclick={() => showTab(before.key)}>
                    <span class="text-dim block text-xs"
                      >‹ {m.common_previous()}</span>
                    <span class="block truncate text-sm font-semibold"
                      >{tabPageLabel(before)}</span>
                  </button>
                {:else}
                  <span class="flex-1" aria-hidden="true"></span>
                {/if}
                {#if after}
                  <button
                    type="button"
                    class="border-border bg-surface hover:bg-surface-2 min-w-0 flex-1 rounded-xl border px-3 py-2 text-right transition-colors duration-150"
                    onclick={() => showTab(after.key)}>
                    <span class="text-dim block text-xs"
                      >{m.common_next()} ›</span>
                    <span class="block truncate text-sm font-semibold"
                      >{tabPageLabel(after)}</span>
                  </button>
                {:else}
                  <span class="flex-1" aria-hidden="true"></span>
                {/if}
              </nav>
            {/if}
          </div>
        {/key}
      </div>
    </div>
  {/if}

  {#if !sheetOpen && (selecting || barEpisode)}
    <div
      bind:clientHeight={floatingHeight}
      class={layout.compact
        ? "fixed inset-x-2 bottom-[calc(var(--bottom-bar-space)+0.5rem)] z-30"
        : "sticky bottom-4 z-20 mx-auto mt-4 w-full max-w-[480px]"}
      transition:fly={{ y: reduced ? 0 : 12, duration: reduced ? 0 : 200 }}>
      {#if selecting}
        <div bind:this={selectionBarEl}>
          <SelectionBar
            count={selected.size}
            span={spanLabel}
            {actions}
            busy={batchMut.loading}
            onAction={(action, ids) => batchMut.mutate({ action, ids })}
            onExit={exitSelection} />
        </div>
      {:else if barEpisode}
        {@const { seasonNumber, episode } = barEpisode}
        {@const code = episodeCode(seasonNumber, episode.number)}
        <UpNextBar
          {episode}
          {code}
          countdown={nextUp
            ? null
            : (upcomingLabel(episode.airDate, now, exactTime) ??
              m.media_not_aired())}
          busy={!!episode.id && episodeBusy(episode.id)}
          onGo={() => goToEpisode(seasonNumber, episode.number)}
          onMark={() => episode.id && markWatched(episode.id)} />
      {/if}
    </div>
  {/if}
</div>

{#if panel}
  {@const { season, episode, before, after } = panel}
  <EpisodePanel
    {episode}
    seasonNumber={season.number}
    code={episodeCode(season.number, episode.number)}
    {exactTime}
    tracked={!!entry}
    {now}
    {tmdbSourceId}
    busy={!!episode.id && episodeBusy(episode.id)}
    previous={neighbour(before)}
    next={neighbour(after)}
    onClose={closePanel}
    onMark={() => {
      if (!episode.id) return;
      // Straight through: move on to the next one, as when watching.
      const done = requestMarkWatched(
        season.number,
        episode.number,
        episode.id,
      );
      if (done && after) openPanel(after);
    }}
    onRewatch={() => episode.id && markWatched(episode.id)}
    onUndo={() => episode.id && markUnwatch(episode.id)}
    onReview={() => reviewEpisode(season, episode)} />
{/if}

{#if goToOpen && sliced}
  <GoToEpisode
    tabs={tabs.filter((t) => t.range)}
    {now}
    title={tabTitle}
    onGo={(episodeNumber) => {
      goToOpen = false;
      if (cutSeason) goToEpisode(cutSeason.number, episodeNumber);
    }}
    onClose={() => (goToOpen = false)} />
{/if}

{#if posterLightbox !== null && posterImages.length > 0}
  <Lightbox images={posterImages} onClose={() => (posterLightbox = null)} />
{/if}

{#if catchup}
  {@const c = catchup}
  <ConfirmationModal
    title={m.media_catch_up_title()}
    message={m.media_catch_up_message({ count: c.count })}
    confirmLabel={m.media_catch_up_confirm()}
    cancelLabel={m.media_catch_up_cancel()}
    busy={confirmCatchupYesMut.loading}
    onConfirm={confirmCatchupYes}
    onCancel={confirmCatchupNo} />
{/if}

{#if rewatchPrompt}
  <ConfirmationModal
    title={m.media_rewatch_prompt_title()}
    message={m.media_rewatch_prompt_message()}
    confirmLabel={m.media_rewatch_prompt_confirm()}
    cancelLabel={rewatchPrompt.count === 1
      ? m.media_rewatch_prompt_cancel_one()
      : m.media_rewatch_prompt_cancel()}
    busy={startRewatchMut.loading}
    onConfirm={() => startRewatchMut.mutate()}
    onCancel={() => (rewatchPrompt = null)} />
{/if}

{#if confirmUnwatchSeasonId}
  <ConfirmationModal
    title={m.media_undo_season_title()}
    message={m.media_undo_season_message()}
    confirmLabel={m.media_undo_all()}
    danger
    busy={confirmUnwatchSeasonMut.loading}
    onConfirm={confirmUnwatchSeason}
    onCancel={() => (confirmUnwatchSeasonId = null)} />
{/if}

{#if reviewTarget}
  <Modal
    title={m.media_review_title({ target: reviewTarget.label })}
    onclose={closeReview}>
    <ReviewsSection
      targetType={reviewTarget.type}
      targetId={reviewTarget.id}
      workTitle={reviewTarget.label}
      compact />
  </Modal>
{/if}
