<script lang="ts">
  import ClampedText from "#lib/components/ClampedText.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { buildGallery, galleryIndex } from "#lib/gallery.js";

  import ExternalRatingChips from "#lib/components/ExternalRatingChips.svelte";
  import { MEDIA_TYPE_LABEL } from "#lib/constants/media-types.js";

  import { localDateInput } from "#lib/date.js";
  import { page } from "$app/state";
  import {
    addLibraryReplay,
    ApiError,
    deleteLibraryEntry,
    deleteLibraryReplay,
    getMediaDetail,
    getMediaExtras,
    updateLibraryEntry,
    upsertLibraryEntry,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import { createEntryTrackingMutations } from "#lib/entry-tracking-mutations.svelte.js";
  import Banner from "#lib/components/Banner.svelte";
  import CommentsPanel from "#lib/components/CommentsPanel.svelte";
  import WorkFriendsStrip from "#lib/components/WorkFriendsStrip.svelte";
  import ShareWorkModal from "#lib/components/ShareWorkModal.svelte";
  import { mediaWork } from "#lib/chat/work-search.js";
  import ConfirmationModal from "#lib/components/ConfirmationModal.svelte";
  import DetailHeroSkeleton from "#lib/components/DetailHeroSkeleton.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import TrackingStatusBadge from "#lib/components/TrackingStatusBadge.svelte";
  import Lightbox from "#lib/components/Lightbox.svelte";
  import MyRatingBadge from "#lib/components/MyRatingBadge.svelte";
  import NoteField from "#lib/components/NoteField.svelte";
  import OwnershipField from "#lib/components/OwnershipField.svelte";
  import WorkHero from "#lib/components/work/WorkHero.svelte";
  import ProgressBar from "#lib/components/ProgressBar.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { mediaCompletionEstimate } from "#lib/media-completion-estimate.js";
  import { tapFeedback } from "#lib/native/haptics.js";
  import ProviderMark from "#lib/components/ProviderMark.svelte";
  import RelatedCarousel from "#lib/components/RelatedCarousel.svelte";
  import ReviewsSection from "#lib/components/ReviewsSection.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { OMDB_API } from "#lib/constants/external-links.js";
  import {
    MEDIA_OWNERSHIP_SOURCES,
    MEDIA_OWNERSHIP_STATUS_OPTIONS,
  } from "#lib/constants/ownership-sources.js";
  import {
    formatDate,
    formatRegion,
    formatRuntimeTimecode,
    joinMeta,
  } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { timeLeftToWatch } from "#lib/pile.js";
  import {
    type MediaType,
    isAnimeUnaired,
    isDormant,
    isGhost,
    progressPercent,
    isMovieUpcoming,
  } from "@loomkeep/shared";

  import { useQueryClient } from "@tanstack/svelte-query";
  import { slide } from "svelte/transition";
  import type { Snippet } from "svelte";
  import ActionBar from "./components/ActionBar.svelte";
  import CastSection from "./components/CastSection.svelte";
  import SagaSection from "./components/SagaSection.svelte";
  import EpisodesSection from "./components/EpisodesSection.svelte";
  import WhereToWatch from "./components/WhereToWatch.svelte";

  const DIRECTOR_LABELS: Record<MediaType, string> = {
    MOVIE: m.media_directed_by(),
    SERIES: m.media_created_by(),
    ANIME: m.media_directed_by(),
  };

  // AniList `format`/`season` enum values, kept as their raw string when
  // unmapped rather than hidden.
  const FORMAT_LABELS: Record<string, string> = {
    TV_SHORT: m.media_short_series(),
    MOVIE: m.media_movie(),
    SPECIAL: m.media_special(),
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: m.media_music_video(),
  };
  const SEASON_LABELS: Record<string, string> = {
    WINTER: m.media_season_winter(),
    SPRING: m.media_season_spring(),
    SUMMER: m.media_season_summer(),
    FALL: m.media_season_fall(),
  };

  // Brand-ish colors per rating source (no official logos — those are
  // trademarked). Literal classes so Tailwind picks them up.

  const queryClient = useQueryClient();

  let confirmRemove = $state(false);
  let trackingExpanded = $state(false);
  const reduced = prefersReducedMotion();

  // EpisodesSection reports its own action failures through this — the
  // query's own `error` covers only the initial load.
  let episodesError = $state<string | null>(null);

  // Poster + backdrop + extras' backdrop gallery (TMDB only), deduped, for the
  // lightbox carousel.
  const galleryImages = $derived.by(() =>
    detail
      ? buildGallery(detail.title, [
          { src: detail.posterUrl || null },
          { src: detail.backdropUrl || null },
          ...(extras?.images ?? []).map((src) => ({ src })),
        ])
      : [],
  );

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  function openLightbox(url: string | null) {
    if (!url) return;
    lightboxIndex = galleryIndex(galleryImages, url, trailerOffset);
    lightboxOpen = true;
  }

  function openTrailer() {
    lightboxIndex = 0;
    lightboxOpen = true;
  }

  let compact = $state(false);

  const type = $derived((page.params.type ?? "").toUpperCase() as MediaType);
  const id = $derived(page.params.id ?? "");
  const detailKey = $derived(keys.media.detail(type, id));

  // Adult-content-blocked titles return 403 with no body worth resolving
  // generically — a distinct local message instead of the query's own error.
  let adultBlocked = $state(false);

  const mediaQuery = createApiQuery(() => ({
    key: detailKey,
    fetch: () => getMediaDetail(type, id),
    enabled: !!type && !!id,
    onError: (err) => {
      adultBlocked = err instanceof ApiError && err.status === 403;
    },
  }));
  $effect(() => {
    if (mediaQuery.data) adultBlocked = false;
  });
  const detail = $derived(mediaQuery.data);
  let sharing = $state(false);
  const error = $derived(
    adultBlocked
      ? m.media_adult_restricted()
      : (mediaQuery.error ?? episodesError),
  );

  async function reload(): Promise<void> {
    await queryClient.refetchQueries({ queryKey: detailKey });
  }

  const { addMut, patchMut, removeMut, addReplayMut, removeReplayMut } =
    createEntryTrackingMutations({
      detailKey: () => detailKey,
      detail: () => detail,
      entryId: () => entry?.id,
      upsert: (d) =>
        upsertLibraryEntry({
          source: d.source,
          sourceId: d.sourceId,
          type: d.type,
          status: "PLANNED",
        }),
      update: (id, changes: Parameters<typeof updateLibraryEntry>[1]) =>
        updateLibraryEntry(id, changes),
      remove: (id) => deleteLibraryEntry(id),
      addReplay: (id) => addLibraryReplay(id),
      removeReplay: (replayId) => deleteLibraryReplay(replayId),
      onRemoveSuccess: () => (confirmRemove = false),
    });

  const saving = $derived(
    addMut.loading ||
      patchMut.loading ||
      addReplayMut.loading ||
      removeReplayMut.loading,
  );

  // Live extras (where to watch, cast, similar). Loaded once per media (keyed on
  // the route), independent of watch-state reloads. Best-effort: errors are
  // swallowed so a provider hiccup never breaks the page.
  const extrasQuery = createApiQuery(() => ({
    key: keys.media.extras(
      type === "ANIME" ? "anilist" : "tmdb",
      id,
      auth.user?.watchRegion ?? null,
    ),
    fetch: () =>
      getMediaExtras(
        type === "ANIME" ? "anilist" : "tmdb",
        id,
        type,
        auth.user?.watchRegion ?? undefined,
      ),
    enabled: !!type && !!id,
  }));
  const extras = $derived(extrasQuery.data);

  // The trailer, when there is one, always sits at slide 0 in the lightbox —
  // images are offset by one to make room for it.
  const trailerOffset = $derived(extras?.trailerVideoId ? 1 : 0);

  const hasProviders = $derived(
    !!extras &&
      (extras.watchProviders.flatrate.length > 0 ||
        extras.watchProviders.free.length > 0 ||
        extras.watchProviders.ads.length > 0 ||
        extras.watchProviders.rent.length > 0 ||
        extras.watchProviders.buy.length > 0),
  );

  // IMDb/RT/Metacritic scores are fetched through OMDb, whose CC BY-NC 4.0
  // license requires attribution wherever that content is displayed.
  const hasOmdbRatings = $derived(
    (extras?.ratings ?? []).some((r) =>
      ["IMDb", "RT", "Metacritic"].includes(r.source),
    ),
  );

  const entry = $derived(detail?.entry ?? null);
  const reviewMeta = $derived(
    detail ? joinMeta(MEDIA_TYPE_LABEL[detail.type], detail.year) : "",
  );
  const isMovie = $derived(detail?.type === "MOVIE");
  let today = $state(localDateInput());
  $effect(() => {
    const timer = setInterval(() => (today = localDateInput()), 60_000);
    return () => clearInterval(timer);
  });
  // Not out yet: an unreleased film or an announced anime. Either can be
  // followed, but shows "À venir" and offers no review or "Mon suivi" panel.
  const upcoming = $derived(
    (isMovie &&
      !!detail?.movieRelease &&
      isMovieUpcoming(detail.movieRelease, today)) ||
      (detail?.type === "ANIME" && isAnimeUnaired(detail.airingStatus)),
  );
  const timeLeft = $derived(
    detail && entry?.progress && !isMovie
      ? timeLeftToWatch(detail.type, detail.runtimeMin, detail.seasons)
      : null,
  );
  const dormant = $derived(entry ? isDormant(entry) : false);
  const estimatedCompletionDate = $derived(
    detail && !isMovie && entry?.status === "WATCHING"
      ? mediaCompletionEstimate(detail, auth.user?.timezone ?? "UTC")
      : null,
  );
  const ghost = $derived(entry ? isGhost(entry) : false);
  const pct = $derived(progressPercent(entry?.progress));

  // Specials (season 0) are excluded from progress; show them last so the
  // regular run leads.
  const orderedSeasons = $derived(
    detail
      ? [...detail.seasons].sort((a, b) => {
          if (a.number === 0) return 1;
          if (b.number === 0) return -1;
          return a.number - b.number;
        })
      : [],
  );

  function toggleFavorite() {
    if (!entry) return;
    patchMut.mutate({ favorite: !entry.favorite });
  }

  // Movies: a single seen/not-seen toggle stands in for progress.
  function toggleWatched() {
    if (!entry) return;
    if (entry.status !== "COMPLETED") tapFeedback();
    patchMut.mutate({
      status: entry.status === "COMPLETED" ? "PLANNED" : "COMPLETED",
    });
  }

  function dropEntry() {
    patchMut.mutate({ status: "DROPPED" });
  }

  function resumeEntry() {
    patchMut.mutate({ status: "WATCHING" });
  }

  // Its own mutation rather than patchMut, for the confirmation toast — the
  // "…" menu has closed by then, so nothing else shows the change took.
  const episodeAlertsMut = createApiMutation(() => ({
    mutate: (muted: boolean) =>
      updateLibraryEntry(entry!.id, { episodeAlertsMuted: muted }),
    invalidates: [detailKey],
    successToast: (_, muted) =>
      muted
        ? m.media_episode_alerts_muted_toast({ title: detail?.title ?? "" })
        : m.media_episode_alerts_unmuted_toast({ title: detail?.title ?? "" }),
    errorToast: true,
  }));
  const movieAlertsMut = createApiMutation(() => ({
    mutate: (enabled: boolean) =>
      updateLibraryEntry(entry!.id, { movieReleaseAlertsEnabled: enabled }),
    invalidates: [detailKey, keys.calendar.upcoming()],
    successToast: (_, enabled) =>
      enabled
        ? m.media_movie_reminder_enabled_toast()
        : m.media_movie_reminder_disabled_toast(),
    errorToast: true,
  }));
</script>

<svelte:head>
  <title
    >{detail
      ? `${detail.title} · ${m.common_loomkeep()}`
      : m.common_loomkeep()}</title>
</svelte:head>

{#if error}
  <div class="mx-auto max-w-4xl px-5 py-6 md:px-8">
    <Banner variant="error">{error}</Banner>
  </div>
{/if}

{#if detail}
  <WorkHero
    title={detail.title}
    backdropUrl={detail.backdropUrl || null}
    coverUrl={detail.posterUrl || null}
    backHref="/app/media"
    backLabel={m.common_Media()}
    onTrailer={extras?.trailerVideoId ? openTrailer : undefined}
    onEnlargeCover={() => openLightbox(detail?.posterUrl ?? null)}
    onCompactChange={(value) => (compact = value)}>
    {#snippet pills()}
      <span
        class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
        {MEDIA_TYPE_LABEL[detail.type]}
      </span>
      {#if upcoming}
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-white backdrop-blur"
          ><Icon
            name="calendar"
            class="h-3.5 w-3.5" />{m.media_upcoming()}</span>
      {:else if entry}
        <TrackingStatusBadge domain="MEDIA" status={entry.status} onImage />
        {#if dormant}
          <span
            title={ghost ? m.media_ghost_hint() : m.media_dormant_hint()}
            class="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-2.5 py-1 text-xs font-bold text-white">
            <Icon name={ghost ? "ghost" : "hourglass"} class="h-3.5 w-3.5" />
            {ghost ? m.media_status_ghost() : m.media_status_paused()}
          </span>
        {/if}
      {/if}
      {#if detail.isAdult}
        <span
          class="bg-danger/80 rounded-full px-2.5 py-0.5 text-xs font-bold text-white">
          18+
        </span>
      {/if}
      {#if extras?.contentRating}
        <span
          title={m.media_official_rating()}
          class="rounded-full border border-white/40 px-2.5 py-0.5 text-xs font-bold text-white">
          {extras.contentRating}
        </span>
      {/if}
    {/snippet}
    {#if extras?.tagline}
      <p class="mt-1 text-sm text-white/70 italic">{extras.tagline}</p>
    {/if}
    <p class="timecode mt-1.5 text-sm text-white/80">
      {#if detail.year}{detail.year}{#if extras?.season}
          &nbsp;· {SEASON_LABELS[extras.season] ?? extras.season}
        {/if}{/if}
      {#if detail.genres.length > 0}
        {#if detail.year}
          ·&nbsp;
        {/if}{detail.genres.slice(0, 3).join(", ")}
      {/if}
      {#if extras?.format && extras.format !== "TV"}
        · {FORMAT_LABELS[extras.format] ?? extras.format}
      {/if}
      {#if !isMovie && detail.seasons.some((s) => s.episodes.length > 0)}
        · {detail.airingFinished ? m.media_airing_finished() : m.media_airing()}
      {/if}
    </p>

    {#if isMovie && detail.movieRelease}
      <p class="mt-2 text-sm text-white/80 tabular-nums">
        {#if detail.movieRelease.localDate}
          {detail.movieRelease.localDate > today
            ? m.media_release_expected()
            : m.media_release_released()}
          {formatDate(`${detail.movieRelease.localDate}T12:00:00`)} ·
          {detail.movieRelease.localType === "cinema"
            ? m.media_release_cinema()
            : m.media_release_digital()} · {detail.movieRelease.region}
        {:else}{m.media_release_local_unknown()} · {detail.movieRelease
            .region}{/if}
      </p>
    {/if}

    {#if (entry && !upcoming) || (extras && extras.ratings.length > 0)}
      <div class="mt-2.5 flex flex-wrap gap-1.5">
        {#if entry && !upcoming}
          <MyRatingBadge
            targetType="MEDIA"
            targetId={entry.mediaItem.id}
            workTitle={detail.title}
            workMeta={reviewMeta}
            workImageUrl={detail.posterUrl}
            overlay />
        {/if}
        <ExternalRatingChips ratings={extras?.ratings ?? []} overlay />
      </div>
      {#if hasOmdbRatings}
        <a
          href={OMDB_API}
          target="_blank"
          rel="noopener noreferrer"
          class="btn-text text-micro mt-1 inline-block">
          {m.media_omdb_notice()}
        </a>
      {/if}
    {/if}
  </WorkHero>

  <ActionBar
    {upcoming}
    airingFinished={detail.airingFinished}
    onToggleMovieAlerts={() =>
      movieAlertsMut.mutate(!entry?.movieReleaseAlertsEnabled)}
    {entry}
    {isMovie}
    saving={saving || movieAlertsMut.loading}
    {compact}
    title={detail.title}
    onAdd={() => addMut.mutate()}
    onToggleFavorite={toggleFavorite}
    onToggleWatched={toggleWatched}
    onDrop={dropEntry}
    onResume={resumeEntry}
    onToggleEpisodeAlerts={() =>
      episodeAlertsMut.mutate(!entry?.episodeAlertsMuted)}
    onRemove={() => (confirmRemove = true)}
    onShare={() => (sharing = true)}>
    {#snippet socialActions()}
      <div class="flex items-center gap-2.5">
        {#if appConfig.socialEnabled && detail.commentTargetId}
          <CommentsPanel
            targetType="MEDIA"
            targetId={detail.commentTargetId}
            title={detail.title}
            canParticipate={!!entry}
            revealSpoilersByDefault={entry?.status === "COMPLETED"}
            compact />
        {/if}
      </div>
    {/snippet}
  </ActionBar>

  <div class="mx-auto max-w-5xl px-5 pb-6 md:px-8 md:pb-10">
    {#if appConfig.socialEnabled && detail.commentTargetId}
      <WorkFriendsStrip
        domain="MEDIA"
        targetType="MEDIA"
        targetId={detail.commentTargetId}
        revision={`${entry?.status}:${entry?.progress?.watchedEpisodes}`} />
    {/if}

    {#if entry?.progress && !upcoming}
      <div class="mt-6 max-w-sm">
        <ProgressBar value={pct} label={m.common_progress()} />
        <p class="timecode mt-1.5 text-sm">
          {entry.progress.watchedEpisodes} / {entry.progress.totalEpisodes}
          {m.media_watched_episodes_suffix()}
          {pct} %
          {#if timeLeft}
            ·
            <span class="text-fg">
              {m.media_time_left({
                time: `${timeLeft.estimated ? "~" : ""}${formatRuntimeTimecode(timeLeft.minutes)}`,
              })}
            </span>
          {/if}
        </p>
        {#if estimatedCompletionDate}
          <p
            class="text-dim mt-2 flex flex-wrap items-center gap-2 text-xs"
            transition:slide={{ duration: reduced ? 0 : 200 }}>
            {detail.airingFinished
              ? m.completion_estimate_finish({
                  date: formatDate(`${estimatedCompletionDate}T12:00:00`),
                })
              : m.completion_estimate_caught_up({
                  date: formatDate(`${estimatedCompletionDate}T12:00:00`),
                })}
            {#if isFeatureNew("completion-estimate")}<NewBadge />{/if}
          </p>
        {/if}
      </div>
    {/if}

    {#snippet synopsis(cls: string)}
      {#if detail.overview}
        <div class={cls}>
          <ClampedText
            text={detail.overview}
            lines={layout.compact ? 3 : 8}
            class="text-dim" />
        </div>
      {/if}
    {/snippet}

    {#snippet tagChips()}
      {#each extras?.tags ?? [] as tag (tag)}
        <span
          class="border-border text-dim rounded-full border px-2 py-0.5 text-[0.65rem]">
          {tag}
        </span>
      {/each}
    {/snippet}

    {#snippet tracking()}
      {#if entry && !upcoming}
        <!-- Set-once settings, not day-to-day actions — tucked away closed by
           default rather than living in the action bar above. -->
        <div
          class="border-border bg-surface mt-6 max-w-xl overflow-hidden rounded-xl border">
          <div
            role="button"
            tabindex="0"
            aria-expanded={trackingExpanded}
            class="flex cursor-pointer items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden {trackingExpanded
              ? 'border-border border-b'
              : ''}"
            onclick={() => (trackingExpanded = !trackingExpanded)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                trackingExpanded = !trackingExpanded;
              }
            }}>
            <Icon
              name="chevron-right"
              class="text-dim h-4 w-4 shrink-0 transition-transform {trackingExpanded
                ? 'rotate-90'
                : ''}" />
            <span class="text-sm font-semibold">{m.tracking_title()}</span>
            <span class="text-dim text-xs">{m.media_tracking_summary()}</span>
          </div>
          {#if trackingExpanded}
            <div
              class="flex flex-col gap-4 px-4 py-4"
              transition:slide|global={{ duration: reduced ? 0 : 200 }}>
              <OwnershipField
                status={entry.ownershipStatus}
                source={entry.ownershipSource}
                statusOptions={MEDIA_OWNERSHIP_STATUS_OPTIONS}
                sourceOptionsByStatus={MEDIA_OWNERSHIP_SOURCES}
                onChange={(status, source) =>
                  patchMut.mutate({
                    ownershipStatus: status as typeof entry.ownershipStatus,
                    ownershipSource: source,
                  })} />

              <NoteField
                value={entry.notes}
                placeholder={m.media_note_placeholder()}
                onChange={(v) => patchMut.mutate({ notes: v })} />

              {#if isMovie && (entry.status === "COMPLETED" || entry.replays.length > 0)}
                <hr class="border-border" />

                <div class="flex flex-col gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <span
                      class="timecode text-micro tracking-[0.18em] uppercase">
                      {m.media_rewatches()}{#if entry.replays.length > 0}
                        &nbsp;· {entry.replays.length}{/if}
                    </span>
                    {#if entry.status === "COMPLETED"}
                      <button
                        type="button"
                        class="link-accent text-xs disabled:opacity-50"
                        disabled={saving}
                        onclick={() => addReplayMut.mutate()}>
                        {m.media_add_rewatch()}
                      </button>
                    {/if}
                  </div>
                  {#if entry.replays.length > 0}
                    <ul class="flex flex-col gap-1">
                      {#each entry.replays as replay (replay.id)}
                        <li class="text-dim flex items-center gap-2 text-xs">
                          <span class="flex-1"
                            >{formatDate(replay.finishedAt)}</span>
                          <button
                            type="button"
                            class="hover:text-danger"
                            aria-label={m.media_delete_rewatch()}
                            disabled={saving}
                            onclick={() => removeReplayMut.mutate(replay.id)}>
                            {m.common_delete()}
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    {/snippet}

    {#snippet whereToWatch()}
      {#if hasProviders && extras}
        <WhereToWatch offers={extras.watchProviders} />
      {/if}
    {/snippet}

    {#snippet linkChips()}
      {#each extras?.externalLinks ?? [] as link (link.url)}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          class="border-border text-dim hover:border-accent hover:text-accent rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold transition-colors">
          {link.name} ↗
        </a>
      {/each}
    {/snippet}

    {#snippet detailRow(label: string, value: Snippet)}
      <div class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 px-4 py-3">
        <dt class="timecode text-dim text-xs">{label}</dt>
        <dd class="flex min-w-0 flex-wrap gap-1.5 text-sm font-semibold">
          {@render value()}
        </dd>
      </div>
    {/snippet}
    {#snippet directorNames()}{extras?.directors.join(", ")}{/snippet}
    {#snippet studioNames()}{extras?.studios.join(", ")}{/snippet}
    {#snippet detailsCard()}
      {#if extras && (extras.directors.length > 0 || extras.studios.length > 0 || extras.tags.length > 0 || extras.externalLinks.length > 0)}
        <dl class="card divide-border divide-y">
          {#if extras.directors.length > 0}
            {@render detailRow(DIRECTOR_LABELS[detail.type], directorNames)}
          {/if}
          {#if extras.studios.length > 0}
            {@render detailRow(
              extras.studios.length > 1 ? m.media_studios() : m.media_studio(),
              studioNames,
            )}
          {/if}
          {#if extras.tags.length > 0}
            {@render detailRow(m.music_tags(), tagChips)}
          {/if}
          {#if extras.externalLinks.length > 0}
            {@render detailRow(m.common_links(), linkChips)}
          {/if}
        </dl>
      {/if}
    {/snippet}

    {#snippet attribution()}
      <!-- Provider attribution: required for TMDB (logo + non-endorsement
         notice, less prominent than Loomkeep's own branding), courtesy for
         AniList. -->
      <p class="text-dim text-micro mt-4 flex items-center gap-1.5">
        <ProviderMark
          brand={type === "ANIME" ? "anilist" : "tmdb"}
          decorative
          class="h-3 w-3 shrink-0 opacity-70" />
        {type === "ANIME"
          ? m.media_anilist_notice()
          : m.datasource_tmdb_notice()}
      </p>
      {#if hasProviders && extras}
        <!-- Under the notice's text, in its type: one block, two sources. -->
        <p class="text-dim text-micro mt-1 pl-[1.125rem]">
          {m.media_watch_attribution({
            region: formatRegion(extras.watchProviders.region),
          })}
        </p>
      {/if}
    {/snippet}

    {#snippet episodes()}
      <!-- Episodes (series/anime). Watch actions only once the media is tracked. -->
      {#if !isMovie && detail.seasons.length > 0}
        <EpisodesSection
          seasons={orderedSeasons}
          {entry}
          mediaType={detail.type}
          sourceId={id}
          {reload}
          onError={(m) => (episodesError = m)} />
      {/if}
    {/snippet}

    {#snippet reviews()}
      {#if entry && !upcoming}
        <ReviewsSection
          targetType="MEDIA"
          targetId={entry.mediaItem.id}
          workTitle={detail.title}
          workMeta={reviewMeta}
          workImageUrl={detail.posterUrl} />
      {/if}
    {/snippet}

    {#snippet works()}
      {#key id}
        <SagaSection {type} sourceId={id} entryStatus={entry?.status ?? null} />
      {/key}

      {#if extras && extras.relations.length > 0}
        <RelatedCarousel
          title={m.media_related_works()}
          items={extras.relations.map((s) => ({
            key: `${s.source}:${s.sourceId}`,
            href: `/app/media/${s.type.toLowerCase()}/${s.sourceId}`,
            cover: s.posterUrl,
            title: s.title,
          }))} />
      {/if}

      {#if extras}
        <RelatedCarousel
          title={m.media_similar_titles()}
          items={extras.similar.map((s) => ({
            key: `${s.source}:${s.sourceId}`,
            href: `/app/media/${s.type.toLowerCase()}/${s.sourceId}`,
            cover: s.posterUrl,
            title: s.title,
          }))} />
      {/if}
    {/snippet}

    {#snippet cast()}
      {#if extras}
        <CastSection
          cast={extras.cast}
          source={type === "ANIME" ? "anilist" : "tmdb"} />
      {/if}
    {/snippet}

    <!-- On a phone, what the page is opened for comes first. -->
    {#if layout.compact}
      {@render synopsis("mt-6")}
      {@render episodes()}
      {@render whereToWatch()}
      {@render tracking()}
      {@render reviews()}
      {@render works()}
      {@render cast()}
      <section class="mt-8">
        <h2 class="font-display mb-3 text-lg font-bold">
          {m.common_details()}
        </h2>
        {@render detailsCard()}
        {@render attribution()}
      </section>
    {:else}
      <!-- Desktop: the credits, tags and links in a column beside the page. -->
      <div class="grid grid-cols-[minmax(0,1fr)_17rem] items-start gap-x-10">
        <div class="min-w-0">
          {@render synopsis("mt-6")}
          {@render tracking()}
          {@render whereToWatch()}
          {@render episodes()}
          {@render reviews()}
          {@render works()}
          {@render cast()}
        </div>
        <aside class="sticky top-20 mt-6">
          {@render detailsCard()}
          {@render attribution()}
        </aside>
      </div>
    {/if}
  </div>

  {#if sharing}
    <ShareWorkModal
      work={mediaWork(detail)}
      sendable={!detail.isAdult}
      onclose={() => (sharing = false)} />
  {/if}

  {#if confirmRemove}
    <ConfirmationModal
      title={m.tracking_remove()}
      message={m.media_remove_message({ title: detail.title })}
      confirmLabel={m.common_remove()}
      danger
      busy={removeMut.loading}
      onConfirm={() => removeMut.mutate()}
      onCancel={() => (confirmRemove = false)} />
  {/if}

  {#if lightboxOpen}
    <Lightbox
      images={galleryImages}
      video={extras?.trailerVideoId
        ? { videoId: extras.trailerVideoId, alt: m.media_trailer() }
        : null}
      bind:index={lightboxIndex}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <DetailHeroSkeleton />
{/if}
