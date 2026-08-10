<script lang="ts">
  import {
    ApiError,
    unwatchEpisode,
    unwatchSeason,
    watchEpisode,
    watchSeason,
    watchThrough,
  } from "$lib/api/client";
  import CommentThread from "$lib/components/CommentThread.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import ReviewsSection from "$lib/components/ReviewsSection.svelte";
  import { appConfig } from "$lib/config.svelte";
  import type {
    CommentTargetType,
    LibraryEntryDto,
    MediaDetailSeasonDto,
    ReviewTargetType,
  } from "@loomkeep/shared";
  import { SvelteDate } from "svelte/reactivity";

  let {
    seasons,
    entry,
    reload,
    onError,
  }: {
    seasons: MediaDetailSeasonDto[];
    entry: LibraryEntryDto | null;
    reload: () => Promise<void>;
    onError: (message: string) => void;
  } = $props();

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  let busyEpisodeId = $state<string | null>(null);
  let busySeasonId = $state<string | null>(null);

  // Fixed-position season "⋮" menu (fixed so it escapes the season card's
  // clipping) — only one open at a time, mirrors the review/comment icons'
  // per-row modals below.
  let seasonMenu = $state<{
    seasonId: string;
    top: number;
    right: number;
  } | null>(null);
  let confirmUnwatchSeasonId = $state<string | null>(null);
  let unwatchingSeasonBusy = $state(false);

  // "Marquer vu" on an episode with unwatched episodes before it asks first —
  // declining once means we stop asking for the rest of this page view
  // (component instance), not persisted beyond that.
  let catchup = $state<{ episodeId: string; count: number } | null>(null);
  let declinedCatchup = $state(false);

  // Each season/episode has its own comment thread (per the target-type
  // granularity), opened in a modal rather than inlined in every row.
  let commentTarget = $state<{
    type: CommentTargetType;
    id: string;
    label: string;
  } | null>(null);

  // Same idea for a season/episode's own review — discreet (icon-triggered
  // modal), never inlined in the row.
  let reviewTarget = $state<{
    type: ReviewTargetType;
    id: string;
    label: string;
  } | null>(null);

  const seasonWatched = (season: MediaDetailSeasonDto) =>
    season.episodes.length > 0 &&
    season.episodes.every((ep) => ep.watchCount > 0);

  const seasonWatchedCount = (season: MediaDetailSeasonDto) =>
    season.episodes.filter((e) => e.watchCount > 0).length;

  // How many regular episodes *before* this one are still unwatched — drives
  // the catch-up prompt. Specials are not part of the linear run.
  function unwatchedGapCount(seasonNumber: number, episodeNumber: number) {
    let count = 0;
    for (const s of seasons) {
      if (s.number === 0) continue;
      for (const ep of s.episodes) {
        const before =
          s.number < seasonNumber ||
          (s.number === seasonNumber && ep.number < episodeNumber);
        if (before && ep.watchCount === 0) count++;
      }
    }
    return count;
  }

  // Calendar-day count until an episode's air date; 0 (or negative) once it's
  // aired, matching the backend's `airDate <= now` gate.
  function daysUntilAir(airDate: string): number {
    const airStart = new SvelteDate(airDate);
    airStart.setHours(0, 0, 0, 0);
    const todayStart = new SvelteDate();
    todayStart.setHours(0, 0, 0, 0);
    return Math.round((airStart.getTime() - todayStart.getTime()) / 86_400_000);
  }

  // Label shown instead of the watch button while an episode hasn't aired yet;
  // null once it can be marked (aired, or airDate unknown as with AniList).
  function upcomingLabel(airDate: string | null): string | null {
    if (!airDate) return null;
    const days = daysUntilAir(airDate);
    if (days <= 0) return null;
    return days === 1 ? "Demain" : `Dans ${days} jours`;
  }

  function openSeasonMenu(event: MouseEvent, seasonId: string) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    seasonMenu = {
      seasonId,
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    };
  }

  async function markWatched(episodeId: string) {
    busyEpisodeId = episodeId;
    onError("");
    try {
      await watchEpisode(episodeId);
      await reload();
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer comme vu",
      );
    } finally {
      busyEpisodeId = null;
    }
  }

  // Entry point for the primary "Marquer vu" button — asks first if it would
  // silently skip over earlier unwatched episodes.
  function requestMarkWatched(
    seasonNumber: number,
    episodeNumber: number,
    episodeId: string,
  ) {
    const gap =
      seasonNumber > 0 ? unwatchedGapCount(seasonNumber, episodeNumber) : 0;
    if (gap > 0 && !declinedCatchup) {
      catchup = { episodeId, count: gap };
    } else {
      void markWatched(episodeId);
    }
  }

  async function confirmCatchupYes() {
    if (!catchup) return;
    const episodeId = catchup.episodeId;
    catchup = null;
    busyEpisodeId = episodeId;
    onError("");
    try {
      await watchThrough(episodeId);
      await reload();
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer les épisodes",
      );
    } finally {
      busyEpisodeId = null;
    }
  }

  function confirmCatchupNo() {
    if (!catchup) return;
    const episodeId = catchup.episodeId;
    declinedCatchup = true;
    catchup = null;
    void markWatched(episodeId);
  }

  async function markSeason(seasonId: string) {
    busySeasonId = seasonId;
    onError("");
    try {
      await watchSeason(seasonId);
      await reload();
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer la saison",
      );
    } finally {
      busySeasonId = null;
    }
  }

  async function confirmUnwatchSeason() {
    if (!confirmUnwatchSeasonId) return;
    const seasonId = confirmUnwatchSeasonId;
    unwatchingSeasonBusy = true;
    onError("");
    try {
      await unwatchSeason(seasonId);
      await reload();
      confirmUnwatchSeasonId = null;
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'annuler la saison",
      );
    } finally {
      unwatchingSeasonBusy = false;
    }
  }

  async function markUnwatch(episodeId: string) {
    busyEpisodeId = episodeId;
    onError("");
    try {
      await unwatchEpisode(episodeId);
      await reload();
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'annuler le visionnage",
      );
    } finally {
      busyEpisodeId = null;
    }
  }
</script>

<h2 class="font-display mt-10 mb-4 text-xl font-bold">Épisodes</h2>
<div class="flex flex-col gap-4 pb-4">
  {#each seasons as season (season.number)}
    <!-- Seasons are collapsible and collapsed by default. -->
    <details class="card group">
      <summary
        class="bg-surface-2 font-display group-open:border-border cursor-pointer list-none rounded-[inherit] px-4 py-2.5 font-semibold group-open:rounded-b-none group-open:border-b [&::-webkit-details-marker]:hidden">
        <div class="flex items-center gap-3">
          <Icon
            name="chevron-right"
            class="text-dim h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
          <span class="min-w-0 flex-1 truncate">
            {season.title ?? `Saison ${season.number}`}
          </span>
          {#if entry}
            <span class="timecode shrink-0 text-xs">
              {seasonWatchedCount(season)}/{season.episodes.length}
            </span>
          {/if}
          {#if entry && season.id && seasonWatched(season)}
            <span
              class="text-success inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
              <Icon name="check" class="h-4 w-4" /> Vue
            </span>
          {/if}
          {#if entry && season.id}
            <button
              class="text-dim hover:text-fg hover:bg-surface-2 grid h-7 w-7 shrink-0 place-items-center rounded-full"
              aria-label="Critique de la saison"
              onclick={(e) => {
                e.preventDefault();
                reviewTarget = {
                  type: "SEASON",
                  id: season.id!,
                  label: season.title ?? `Saison ${season.number}`,
                };
              }}>
              <Icon name="star" class="h-4 w-4" />
            </button>
          {/if}
          {#if entry && appConfig.socialEnabled && season.id}
            <button
              class="text-dim hover:text-fg hover:bg-surface-2 grid h-7 w-7 shrink-0 place-items-center rounded-full"
              aria-label="Commentaires de la saison"
              onclick={(e) => {
                e.preventDefault();
                commentTarget = {
                  type: "SEASON",
                  id: season.id!,
                  label: season.title ?? `Saison ${season.number}`,
                };
              }}>
              <Icon name="message" class="h-4 w-4" />
            </button>
          {/if}
          {#if entry && season.id}
            <button
              class="text-dim hover:text-fg hover:bg-surface-2 grid h-7 w-7 shrink-0 place-items-center rounded-full"
              aria-label="Plus d'actions pour la saison"
              aria-haspopup="menu"
              onclick={(e) => {
                e.preventDefault();
                openSeasonMenu(e, season.id!);
              }}>
              <Icon name="dots-vertical" class="h-4 w-4" />
            </button>
          {/if}
        </div>
        {#if entry && season.episodes.length > 0}
          {@const seasonPct = Math.round(
            (seasonWatchedCount(season) / season.episodes.length) * 100,
          )}
          <div
            class="bg-border mt-2 h-[3px] w-full overflow-hidden rounded-full">
            <div class="bg-accent h-full" style={`width: ${seasonPct}%`}></div>
          </div>
        {/if}
      </summary>
      <ul>
        {#each season.episodes as episode (episode.number)}
          {@const watched = episode.watchCount > 0}
          <li class="border-border border-b last:border-b-0">
            <div class="flex items-center gap-3 px-4 py-2.5">
              <span class="timecode w-14 shrink-0 text-sm">
                S{String(season.number).padStart(2, "0")}E{String(
                  episode.number,
                ).padStart(2, "0")}
              </span>
              <span class="min-w-0 flex-1 truncate text-sm">
                {episode.title ?? `Épisode ${episode.number}`}
                {#if episode.watchCount > 1}
                  <span class="text-success">×{episode.watchCount}</span>
                {/if}
              </span>
              {#if watched && episode.id}
                <span
                  class="text-success inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                  <Icon name="check" class="h-4 w-4" />
                  {dateFmt.format(new Date(episode.watches[0].watchedAt))}
                </span>
              {/if}
              {#if entry && episode.id}
                <button
                  class="text-dim hover:text-fg hover:bg-surface-2 grid h-7 w-7 shrink-0 place-items-center rounded-full"
                  aria-label="Critique de l'épisode"
                  onclick={() => {
                    reviewTarget = {
                      type: "EPISODE",
                      id: episode.id!,
                      label: `S${String(season.number).padStart(2, "0")}E${String(episode.number).padStart(2, "0")}`,
                    };
                  }}>
                  <Icon name="star" class="h-4 w-4" />
                </button>
              {/if}
              {#if entry && appConfig.socialEnabled && episode.id}
                <button
                  class="text-dim hover:text-fg hover:bg-surface-2 grid h-7 w-7 shrink-0 place-items-center rounded-full"
                  aria-label="Commentaires de l'épisode"
                  onclick={() => {
                    commentTarget = {
                      type: "EPISODE",
                      id: episode.id!,
                      label: `S${String(season.number).padStart(2, "0")}E${String(episode.number).padStart(2, "0")}`,
                    };
                  }}>
                  <Icon name="message" class="h-4 w-4" />
                </button>
              {/if}
              {#if entry && episode.id}
                {@const upcoming = !watched && upcomingLabel(episode.airDate)}
                {#if upcoming}
                  <span
                    class="border-border text-dim shrink-0 rounded-lg border px-2.5 py-1 text-xs"
                    title="Pas encore diffusé">
                    {upcoming}
                  </span>
                {:else if watched}
                  <!-- Rare, secondary actions on an already-watched episode:
                       two quiet icon buttons rather than a hidden menu. -->
                  <div class="flex shrink-0 items-center gap-1">
                    <button
                      class="text-dim hover:text-fg hover:bg-surface-2 grid h-7 w-7 place-items-center rounded-full disabled:opacity-50"
                      title="Revoir"
                      aria-label="Revoir"
                      disabled={busyEpisodeId === episode.id}
                      onclick={() => markWatched(episode.id!)}>
                      <Icon name="refresh" class="h-4 w-4" />
                    </button>
                    <button
                      class="text-dim hover:text-danger hover:bg-surface-2 grid h-7 w-7 place-items-center rounded-full disabled:opacity-50"
                      title="Annuler ce visionnage"
                      aria-label="Annuler ce visionnage"
                      disabled={busyEpisodeId === episode.id}
                      onclick={() => markUnwatch(episode.id!)}>
                      <Icon name="x" class="h-4 w-4" />
                    </button>
                  </div>
                {:else}
                  <button
                    class="btn btn-primary shrink-0 px-2.5 py-1 text-xs"
                    disabled={busyEpisodeId === episode.id}
                    onclick={() =>
                      requestMarkWatched(
                        season.number,
                        episode.number,
                        episode.id!,
                      )}>
                    Marquer vu
                  </button>
                {/if}
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </details>
  {/each}
</div>

<!-- Season "⋮" menu (fixed so it escapes the season card's clipping). -->
{#if seasonMenu}
  {@const active = seasonMenu}
  {@const activeSeason = seasons.find((s) => s.id === active.seasonId)}
  <button
    class="fixed inset-0 z-30 cursor-default"
    aria-label="Fermer le menu"
    onclick={() => (seasonMenu = null)}></button>
  <div
    role="menu"
    class="border-border bg-surface fixed z-40 min-w-64 overflow-hidden rounded-lg border shadow-lg"
    style={`top: ${active.top}px; right: ${active.right}px`}>
    {#if activeSeason && !seasonWatched(activeSeason)}
      <button
        role="menuitem"
        class="hover:bg-surface-2 flex w-full items-center gap-2 px-3 py-2 text-left text-sm whitespace-nowrap"
        disabled={busySeasonId === active.seasonId}
        onclick={() => {
          const seasonId = active.seasonId;
          seasonMenu = null;
          markSeason(seasonId);
        }}>
        <Icon name="check" class="h-4 w-4" /> Marquer la saison vue
      </button>
    {/if}
    {#if activeSeason && seasonWatchedCount(activeSeason) > 0}
      <button
        role="menuitem"
        class="hover:bg-surface-2 text-danger border-border flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm whitespace-nowrap"
        onclick={() => {
          const seasonId = active.seasonId;
          seasonMenu = null;
          confirmUnwatchSeasonId = seasonId;
        }}>
        <Icon name="x" class="h-4 w-4" /> Tout annuler la saison
      </button>
    {/if}
  </div>
{/if}

{#if catchup}
  {@const c = catchup}
  <ConfirmationModal
    title="Rattraper les épisodes précédents ?"
    message={`Tu as ${c.count} épisode${c.count > 1 ? "s" : ""} non vu${c.count > 1 ? "s" : ""} avant celui-ci.`}
    confirmLabel="Oui, tout marquer"
    cancelLabel="Non, juste celui-ci"
    busy={busyEpisodeId === c.episodeId}
    onConfirm={confirmCatchupYes}
    onCancel={confirmCatchupNo} />
{/if}

{#if confirmUnwatchSeasonId}
  <ConfirmationModal
    title="Tout annuler pour cette saison"
    message="Tous les visionnages de cette saison (rediffusions comprises) seront supprimés. Cette action est irréversible."
    confirmLabel="Tout annuler"
    danger
    busy={unwatchingSeasonBusy}
    onConfirm={confirmUnwatchSeason}
    onCancel={() => (confirmUnwatchSeasonId = null)} />
{/if}

{#if commentTarget}
  <Modal
    title={`Commentaires · ${commentTarget.label}`}
    onclose={() => (commentTarget = null)}>
    <CommentThread
      targetType={commentTarget.type}
      targetId={commentTarget.id} />
  </Modal>
{/if}

{#if reviewTarget}
  <Modal
    title={`Critique · ${reviewTarget.label}`}
    onclose={() => (reviewTarget = null)}>
    <ReviewsSection
      targetType={reviewTarget.type}
      targetId={reviewTarget.id}
      workTitle={reviewTarget.label}
      compact />
  </Modal>
{/if}
