<script lang="ts">
  import { page } from "$app/state";
  import {
    ApiError,
    deleteGameEntry,
    getGameDetail,
    updateGameEntry,
    upsertGameEntry,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { goBack } from "$lib/backNav.svelte";
  import { toCarouselItems } from "$lib/carousel";
  import Banner from "$lib/components/Banner.svelte";
  import CommentsPanel from "$lib/components/CommentsPanel.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import DetailHeroSkeleton from "$lib/components/DetailHeroSkeleton.svelte";
  import GameSessionDock from "$lib/components/GameSessionDock.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Lightbox from "$lib/components/Lightbox.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import MyRatingBadge from "$lib/components/MyRatingBadge.svelte";
  import NoteField from "$lib/components/NoteField.svelte";
  import OwnershipField from "$lib/components/OwnershipField.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import ProviderMark from "$lib/components/ProviderMark.svelte";
  import RelatedCarousel from "$lib/components/RelatedCarousel.svelte";
  import ReviewsSection from "$lib/components/ReviewsSection.svelte";
  import SegmentedStatusControl from "$lib/components/SegmentedStatusControl.svelte";
  import TrackingPanel from "$lib/components/TrackingPanel.svelte";
  import TrackingStatusBadge from "$lib/components/TrackingStatusBadge.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { IGDB_API } from "$lib/constants/external-links";
  import {
    GAME_OWNERSHIP_SOURCES,
    GAME_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/constants/ownership-sources";
  import {
    GAME_STATUS_SEG_ACTIVE as SEG_ACTIVE,
    GAME_STATUS_DESC as STATUS_DESC,
    GAME_STATUS_META as STATUS_META,
    GAME_STATUS_ORDER as STATUS_ORDER,
  } from "$lib/constants/status-labels";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import { createEntryTrackingMutations } from "$lib/entry-tracking-mutations.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { joinMeta } from "$lib/format";
  import { gameReleaseLabel, isVagueRelease } from "$lib/game-release";
  import { releaseDigestOff } from "$lib/release-alerts";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import {
    GAME_DIRECT_STATUS_TARGETS,
    getStatusCorrections,
  } from "$lib/status-corrections";
  import type { GameEntryDto } from "@loomkeep/shared";
  import { slide } from "svelte/transition";
  import GameTimeToBeat from "./components/GameTimeToBeat.svelte";

  // IGDB is the only game source today; the web route carries just the id.
  const SOURCE = "igdb";

  // Brand-ish colors per rating source (no official logos — those are
  // trademarked). Literal classes so Tailwind picks them up.
  const RATING_STYLES: Record<string, string> = {
    IGDB: "bg-[#9147ff] text-white",
    Critiques: "bg-[#66cc33] text-black",
  };

  let confirmRemove = $state(false);
  let statusEditorOpen = $state(false);
  let historyOpen = $state(false);
  const reduced = prefersReducedMotion();

  const id = $derived(page.params.id ?? "");
  const detailKey = $derived(keys.games.detail(SOURCE, id));

  // Adult-content-blocked games return 403 with no body worth resolving
  // generically — a distinct local message instead of the query's own error.
  let adultBlocked = $state(false);

  const gameQuery = createApiQuery(() => ({
    key: detailKey,
    fetch: () => getGameDetail(SOURCE, id),
    enabled: !!id,
    onError: (err) => {
      adultBlocked = err instanceof ApiError && err.status === 403;
    },
  }));
  $effect(() => {
    if (gameQuery.data) adultBlocked = false;
  });
  const detail = $derived(gameQuery.data);
  const error = $derived(
    adultBlocked ? m.game_adult_restricted() : gameQuery.error,
  );

  const entry = $derived(detail?.entry ?? null);
  const upcoming = $derived(!!detail?.upcoming);
  // With no release summary on, the reminder would change nothing.
  const digestOff = $derived(releaseDigestOff());
  const reviewMeta = $derived(
    detail ? joinMeta(m.game_type(), detail.year) : "",
  );
  const hasMeta = $derived(
    !!detail &&
      (detail.developers.length > 0 ||
        detail.publishers.length > 0 ||
        detail.gameModes.length > 0 ||
        detail.playerPerspectives.length > 0 ||
        detail.multiplayerModes.length > 0),
  );
  const hasSidePanels = $derived(hasMeta || !!detail?.timeToBeat);

  // Cover + backdrop + screenshots, deduped, for the lightbox carousel.
  const galleryImages = $derived.by(() => {
    if (!detail) return [];
    const urls: string[] = [];
    if (detail.coverUrl) urls.push(detail.coverUrl);
    if (detail.backdropUrl && !urls.includes(detail.backdropUrl)) {
      urls.push(detail.backdropUrl);
    }
    for (const s of detail.screenshots) if (!urls.includes(s)) urls.push(s);
    return urls.map((src) => ({ src, alt: detail!.title }));
  });

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  // Images are offset by one slide when a trailer is shown, since the
  // trailer always sits at index 0 in the lightbox.
  const trailerOffset = $derived(detail?.trailerVideoId ? 1 : 0);

  function openLightbox(url: string | null) {
    if (!url) return;
    const i = galleryImages.findIndex((img) => img.src === url);
    lightboxIndex = (i >= 0 ? i : 0) + trailerOffset;
    lightboxOpen = true;
  }

  function openTrailer() {
    lightboxIndex = 0;
    lightboxOpen = true;
  }

  const { addMut, patchMut, removeMut } = createEntryTrackingMutations({
    detailKey: () => detailKey,
    detail: () => detail,
    entryId: () => entry?.id,
    upsert: (d) =>
      upsertGameEntry({
        source: d.source,
        sourceId: d.sourceId,
        status: "BACKLOG",
      }),
    update: (id, changes: Parameters<typeof updateGameEntry>[1]) =>
      updateGameEntry(id, changes),
    remove: (id) => deleteGameEntry(id),
    onRemoveSuccess: () => (confirmRemove = false),
  });

  const releaseAlertsMut = createApiMutation(() => ({
    mutate: (enabled: boolean) =>
      updateGameEntry(entry!.id, { releaseAlertsEnabled: enabled }),
    invalidates: [detailKey, keys.calendar.upcoming()],
    successToast: (_, enabled) =>
      enabled
        ? m.game_release_reminder_enabled_toast()
        : m.media_movie_reminder_disabled_toast(),
    errorToast: true,
  }));

  const saving = $derived(
    addMut.loading || patchMut.loading || releaseAlertsMut.loading,
  );
  const statusCorrections = $derived(
    entry
      ? getStatusCorrections(
          STATUS_ORDER,
          entry.status,
          GAME_DIRECT_STATUS_TARGETS[entry.status],
        ).filter(
          (status) =>
            status !== "BACKLOG" ||
            !entry.playthroughs.some(
              (playthrough) =>
                playthrough.status === "ACTIVE" && playthrough.sessionCount > 0,
            ),
        )
      : [],
  );

  function openStatusCorrection() {
    if (statusCorrections.length === 1) {
      patchMut.mutate({ status: statusCorrections[0]! });
      return;
    }
    statusEditorOpen = true;
  }
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
    <a href="/app/games" onclick={goBack} class="btn btn-ghost mt-4"
      >← {m.common_Games()}</a>
  </div>
{/if}

{#if detail}
  <!-- Hero: real artwork, gradient fallback fading into the page. -->
  <div class="relative">
    {#if detail.backdropUrl}
      <button
        type="button"
        class="block w-full cursor-zoom-in"
        aria-label={m.common_enlarge_image()}
        onclick={() => openLightbox(detail?.backdropUrl ?? null)}>
        <img
          src={detail.backdropUrl}
          alt=""
          class="h-44 w-full object-cover md:h-60" />
      </button>
    {:else}
      <div
        class="from-surface-2 to-surface h-44 w-full bg-linear-to-br md:h-60">
      </div>
    {/if}
    <div
      class="from-bg via-bg/50 absolute inset-0 bg-linear-to-t to-transparent">
    </div>
    {#if detail.trailerVideoId}
      <button
        type="button"
        class="absolute top-1/2 left-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
        aria-label={m.media_watch_trailer()}
        onclick={openTrailer}>
        <Icon name="play" class="pointer-events-none h-7 w-7" />
      </button>
    {/if}
    <a
      href="/app/games"
      onclick={goBack}
      class="border-border bg-bg/60 hover:bg-bg absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold backdrop-blur">
      ← {m.common_Games()}
    </a>
  </div>

  <!-- relative z-10: the positioned hero would otherwise paint over the cover
       pulled up into it. -->
  <div class="relative z-10 mx-auto max-w-5xl px-5 pb-6 md:px-8 md:pb-10">
    <div class="md:grid md:grid-cols-[1fr_260px] md:items-start md:gap-8">
      <div class="min-w-0">
        <div
          class="-mt-24 flex flex-col gap-5 sm:flex-row sm:items-end md:-mt-28">
          <button
            type="button"
            class="border-border w-32 shrink-0 overflow-hidden rounded-xl border shadow-lg md:w-44 {detail.coverUrl
              ? 'cursor-zoom-in'
              : ''}"
            aria-label={m.common_enlarge_image()}
            onclick={() => openLightbox(detail?.coverUrl ?? null)}>
            <Poster src={detail.coverUrl} title={detail.title} alt="" />
          </button>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="bg-surface-2 text-dim rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {m.game_type()}
              </span>
              {#if detail.isAdult}
                <span
                  class="bg-danger/15 text-danger rounded-full px-2.5 py-0.5 text-xs font-bold">
                  18+
                </span>
              {/if}
              {#each detail.ageRatingImageUrls as url (url)}
                <img src={url} alt={m.game_age_rating()} class="h-6 rounded" />
              {/each}
              {#if upcoming}
                <span
                  class="bg-surface-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold">
                  <Icon name="calendar" class="h-3.5 w-3.5" />
                  {m.media_upcoming()}
                </span>
              {:else if entry}
                <TrackingStatusBadge domain="GAMES" status={entry.status} />
              {/if}
            </div>
            <h1
              class="font-display mt-2 text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
              {detail.title}
            </h1>
            <p class="timecode mt-1.5 text-sm">
              {#if detail.year}{detail.year}{/if}
              {#if detail.genres.length > 0}
                {#if detail.year}·{/if}
                {detail.genres.slice(0, 3).join(", ")}
              {/if}
            </p>
            {#if upcoming}
              {@const release = gameReleaseLabel(
                detail.releaseDate,
                detail.releaseDatePrecision,
              )}
              {#if release}
                <p class="timecode mt-1 text-sm">{release}</p>
              {/if}
            {/if}
            {#if (entry && !upcoming) || detail.ratings.length > 0}
              <div class="mt-2.5 flex flex-wrap gap-1.5">
                {#if entry && !upcoming}
                  <MyRatingBadge
                    targetType="GAME"
                    targetId={entry.game.id}
                    workTitle={detail.title}
                    workMeta={reviewMeta}
                    workImageUrl={detail.coverUrl} />
                {/if}
                {#each detail.ratings as r (r.source)}
                  <svelte:element
                    this={r.url ? "a" : "span"}
                    href={r.url}
                    target={r.url ? "_blank" : undefined}
                    rel={r.url ? "noopener noreferrer" : undefined}
                    class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold {RATING_STYLES[
                      r.source
                    ] ?? 'bg-surface-2 text-fg'} {r.url
                      ? 'transition-opacity hover:opacity-80'
                      : ''}">
                    <span>{r.source}</span>
                    <span class="tabular-nums opacity-90">{r.score}</span>
                  </svelte:element>
                {/each}
              </div>
            {/if}
            {#if detail.platforms.length > 0}
              <div class="mt-2.5 flex flex-wrap gap-1.5">
                {#each detail.platforms as platform (platform)}
                  <span
                    class="bg-surface-2 text-dim rounded-md px-2 py-0.5 text-xs">
                    {platform}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        {#if detail.overview}
          <p class="text-dim mt-6 max-w-2xl whitespace-pre-line">
            {detail.overview}
          </p>
        {/if}

        {#if detail.storyline}
          <div class="mt-3 max-w-2xl">
            <button
              type="button"
              class="btn-text group"
              aria-expanded={historyOpen}
              onclick={() => (historyOpen = !historyOpen)}>
              <Icon
                name="chevron-down"
                class="h-3.5 w-3.5 shrink-0 transition-transform duration-200 {historyOpen
                  ? 'rotate-0'
                  : '-rotate-90'}" />
              <span
                class="underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover:decoration-current">
                {m.game_story()}
              </span>
            </button>
            {#if historyOpen}
              <p
                transition:slide|global={{ duration: reduced ? 0 : 200 }}
                class="text-dim mt-2 px-4.5 whitespace-pre-line">
                {detail.storyline}
              </p>
            {/if}
          </div>
        {/if}

        {#if !entry}
          <div class="mt-6">
            <button
              class="btn btn-primary"
              disabled={saving}
              onclick={() => addMut.mutate()}>
              <Icon name="plus" class="h-4 w-4" />
              {m.library_add()}
            </button>
          </div>
        {:else}
          <TrackingPanel
            favorite={entry.favorite}
            {saving}
            onToggleFavorite={() =>
              patchMut.mutate({ favorite: !entry.favorite })}
            onRemove={() => (confirmRemove = true)}
            actions={upcoming
              ? []
              : [
                  ...(entry.status === "PLAYING"
                    ? [
                        {
                          label: m.game_status_mark_completed(),
                          icon: "check" as const,
                          onSelect: () =>
                            patchMut.mutate({ status: "COMPLETED" }),
                        },
                        {
                          label: m.game_status_drop(),
                          icon: "archive" as const,
                          onSelect: () =>
                            patchMut.mutate({ status: "DROPPED" }),
                        },
                      ]
                    : []),
                  ...(entry.status === "DROPPED"
                    ? [
                        {
                          label: m.game_status_resume(),
                          icon: "refresh" as const,
                          onSelect: () =>
                            patchMut.mutate({ status: "PLAYING" }),
                        },
                      ]
                    : []),
                  {
                    label:
                      statusCorrections.length === 1
                        ? m.game_status_reset_backlog()
                        : m.tracking_correct_status(),
                    icon: "edit" as const,
                    separator: true,
                    onSelect: openStatusCorrection,
                  },
                ]}
            targetType="GAME"
            targetId={entry.game.id}>
            {#if upcoming}
              {@render releaseReminder(entry)}
            {:else}
              <GameSessionDock {entry} {detailKey} />

              <hr class="border-border" />

              <OwnershipField
                status={entry.ownershipStatus}
                source={entry.ownershipSource}
                statusOptions={GAME_OWNERSHIP_STATUS_OPTIONS}
                sourceOptionsByStatus={GAME_OWNERSHIP_SOURCES}
                onChange={(status, source) =>
                  patchMut.mutate({
                    ownershipStatus: status as typeof entry.ownershipStatus,
                    ownershipSource: source,
                  })} />
            {/if}

            <hr class="border-border" />

            <NoteField
              value={entry.notes}
              placeholder={m.game_note_placeholder()}
              onChange={(v) => patchMut.mutate({ notes: v })} />
          </TrackingPanel>
        {/if}

        <!-- Side panels, mobile position: after "Mon suivi", before the carousels. -->
        {#if hasSidePanels}
          <div class="mt-8 md:hidden">
            {@render sidePanels()}
          </div>
        {/if}

        <RelatedCarousel
          title={detail.franchiseName
            ? m.game_franchise_title({ name: detail.franchiseName })
            : m.game_same_franchise()}
          items={toCarouselItems(detail.franchiseGames, "/app/games")} />

        <RelatedCarousel
          title={m.media_similar_titles()}
          items={toCarouselItems(detail.similarGames, "/app/games")} />

        <!-- Attribution required by the IGDB API/Data Commercial Usage
             Addendum: linked mention on every page using IGDB Services. -->
        <a
          href={IGDB_API}
          target="_blank"
          rel="noopener noreferrer"
          class="text-dim hover:text-accent text-micro mt-4 flex w-fit items-center gap-1.5 transition-colors">
          <ProviderMark
            brand="igdb"
            decorative
            class="h-3 w-3 shrink-0 opacity-70" />
          {m.datasource_igdb_notice()}
        </a>

        {#if entry && !upcoming}
          <ReviewsSection
            targetType="GAME"
            targetId={entry.game.id}
            workTitle={detail.title}
            workMeta={reviewMeta}
            workImageUrl={detail.coverUrl}>
            {#snippet actions()}
              {#if appConfig.socialEnabled && detail.commentTargetId}
                <CommentsPanel
                  targetType="GAME"
                  targetId={detail.commentTargetId}
                  title={detail.title}
                  canParticipate={!!entry} />
              {/if}
            {/snippet}
          </ReviewsSection>
        {/if}
        {#if appConfig.socialEnabled && detail.commentTargetId && (!entry || upcoming)}
          <CommentsPanel
            targetType="GAME"
            targetId={detail.commentTargetId}
            title={detail.title}
            canParticipate={!!entry} />
        {/if}
      </div>

      {#snippet bellButton(entry: GameEntryDto)}
        <button
          type="button"
          class="grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-50 {entry.releaseAlertsEnabled
            ? 'bg-accent text-accent-fg'
            : 'border-border text-dim border'}"
          disabled={saving || digestOff}
          aria-pressed={entry.releaseAlertsEnabled}
          aria-label={entry.releaseAlertsEnabled
            ? m.media_movie_reminder_cancel()
            : m.media_movie_reminder_enable()}
          title={digestOff
            ? undefined
            : entry.releaseAlertsEnabled
              ? m.media_movie_reminder_cancel()
              : m.media_movie_reminder_enable()}
          onclick={() => releaseAlertsMut.mutate(!entry.releaseAlertsEnabled)}>
          <Icon
            name={entry.releaseAlertsEnabled ? "bell" : "bell-off"}
            class="h-5 w-5" />
        </button>
      {/snippet}

      {#snippet releaseReminder(entry: GameEntryDto)}
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            {#if digestOff}
              <Tooltip
                text={m.release_alerts_channels_off()}
                class="inline-flex shrink-0">
                {@render bellButton(entry)}
              </Tooltip>
            {:else}
              {@render bellButton(entry)}
            {/if}
            <div class="min-w-0 text-sm">
              <p>
                {entry.releaseAlertsEnabled
                  ? m.media_movie_reminder_active()
                  : m.media_movie_reminder_enable()}
                {#if isFeatureNew("game-releases")}<NewBadge />{/if}
              </p>
              {#if entry.releaseAlertsEnabled && isVagueRelease(detail?.releaseDatePrecision ?? null)}
                <p class="text-dim text-xs">
                  {m.game_release_reminder_vague_hint()}
                </p>
              {/if}
            </div>
          </div>
          {#if digestOff}
            <a
              href="/app/settings/communications"
              class="text-accent text-sm underline"
              >{m.media_movie_reminder_channels_disabled()}</a>
          {/if}
          <p class="text-dim text-xs">{m.game_upcoming_tracking_hint()}</p>
        </div>
      {/snippet}

      <!-- Side panels, desktop position: sidebar next to the main column. -->
      {#snippet sidePanels()}
        <div class="flex flex-col gap-4">
          {#if hasMeta}
            {@render detailsPanel()}
          {/if}
          {#if detail?.timeToBeat}
            <GameTimeToBeat timeToBeat={detail.timeToBeat} />
          {/if}
        </div>
      {/snippet}
      {#snippet detailsPanel()}
        <div class="card p-4">
          <h2 class="font-display text-sm font-bold tracking-tight">
            {m.common_details()}
          </h2>
          <dl class="mt-3 flex flex-col gap-3">
            {#if detail && detail.developers.length > 0}
              <div>
                <dt class="timecode text-xs">{m.media_developer()}</dt>
                <dd class="mt-0.5 text-sm">
                  {detail.developers.join(", ")}
                </dd>
              </div>
            {/if}
            {#if detail && detail.publishers.length > 0}
              <div>
                <dt class="timecode text-xs">{m.media_publisher()}</dt>
                <dd class="mt-0.5 text-sm">
                  {detail.publishers.join(", ")}
                </dd>
              </div>
            {/if}
            {#if detail && detail.gameModes.length > 0}
              <div>
                <dt class="timecode text-xs">{m.game_play_modes()}</dt>
                <dd class="mt-0.5 text-sm">{detail.gameModes.join(", ")}</dd>
              </div>
            {/if}
            {#if detail && detail.playerPerspectives.length > 0}
              <div>
                <dt class="timecode text-xs">{m.game_view()}</dt>
                <dd class="mt-0.5 text-sm">
                  {detail.playerPerspectives.join(", ")}
                </dd>
              </div>
            {/if}
            {#if detail && detail.multiplayerModes.length > 0}
              <div>
                <dt class="timecode text-xs">{m.game_multiplayer()}</dt>
                <dd class="mt-0.5 text-sm">
                  {detail.multiplayerModes.join(", ")}
                </dd>
              </div>
            {/if}

            {#if detail && detail.website}
              <a
                href={detail.website}
                target="_blank"
                rel="noopener noreferrer"
                class="link-accent mt-0.5 w-fit text-xs decoration-1">
                {m.media_official_site()}
              </a>
            {/if}
          </dl>
        </div>
      {/snippet}
      {#if hasSidePanels}
        <div class="hidden md:block">
          {@render sidePanels()}
        </div>
      {/if}
    </div>
  </div>

  {#if confirmRemove}
    <ConfirmationModal
      title={m.tracking_remove()}
      message={m.library_remove_message({ title: detail.title })}
      confirmLabel={m.common_remove()}
      danger
      busy={removeMut.loading}
      onConfirm={() => removeMut.mutate()}
      onCancel={() => (confirmRemove = false)} />
  {/if}

  {#if statusEditorOpen && entry}
    <Modal
      title={m.tracking_correct_status()}
      onclose={() => (statusEditorOpen = false)}>
      <p class="text-dim mb-4 text-sm">
        {m.tracking_correct_status_help()}
      </p>
      <SegmentedStatusControl
        statuses={statusCorrections}
        current={entry.status}
        disabled={saving}
        meta={STATUS_META}
        desc={STATUS_DESC}
        activeClass={SEG_ACTIVE}
        onSelect={(status) => {
          statusEditorOpen = false;
          patchMut.mutate({ status });
        }} />
    </Modal>
  {/if}

  {#if lightboxOpen}
    <Lightbox
      images={galleryImages}
      video={detail.trailerVideoId
        ? { videoId: detail.trailerVideoId, alt: m.media_trailer() }
        : null}
      bind:index={lightboxIndex}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <DetailHeroSkeleton />
{/if}
