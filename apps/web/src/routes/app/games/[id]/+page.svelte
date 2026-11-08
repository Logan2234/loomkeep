<script lang="ts">
  import ClampedText from "#lib/components/ClampedText.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import StatusCorrectionModal from "#lib/components/StatusCorrectionModal.svelte";
  import { buildGallery, galleryIndex } from "#lib/gallery.js";

  import ExternalRatingChips from "#lib/components/ExternalRatingChips.svelte";
  import DetailsCard from "#lib/components/DetailsCard.svelte";
  import WorkSocialSection from "#lib/components/WorkSocialSection.svelte";
  import { page } from "$app/state";
  import {
    ApiError,
    deleteGameEntry,
    getGameDetail,
    getGameSaga,
    updateGameEntry,
    upsertGameEntry,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { goBack } from "#lib/back-nav.svelte.js";
  import { toCarouselItems } from "#lib/carousel.js";
  import Banner from "#lib/components/Banner.svelte";
  import WorkFriendsStrip from "#lib/components/WorkFriendsStrip.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import ConfirmationModal from "#lib/components/ConfirmationModal.svelte";
  import DetailHeroSkeleton from "#lib/components/DetailHeroSkeleton.svelte";
  import GameSessionDock from "#lib/components/GameSessionDock.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Lightbox from "#lib/components/Lightbox.svelte";

  import MyRatingBadge from "#lib/components/MyRatingBadge.svelte";
  import NoteField from "#lib/components/NoteField.svelte";
  import OwnershipField from "#lib/components/OwnershipField.svelte";
  import CommentsPanel from "#lib/components/CommentsPanel.svelte";
  import WorkActionBar from "#lib/components/work/WorkActionBar.svelte";
  import WorkHero from "#lib/components/work/WorkHero.svelte";
  import WorkTrackingFold from "#lib/components/work/WorkTrackingFold.svelte";
  import ProviderMark from "#lib/components/ProviderMark.svelte";
  import RelatedCarousel from "#lib/components/RelatedCarousel.svelte";

  import ShareWorkModal from "#lib/components/ShareWorkModal.svelte";
  import { gameWork } from "#lib/chat/work-search.js";
  import TrackingStatusBadge from "#lib/components/TrackingStatusBadge.svelte";

  import { IGDB_API } from "#lib/constants/external-links.js";
  import {
    GAME_OWNERSHIP_SOURCES,
    GAME_OWNERSHIP_STATUS_OPTIONS,
  } from "#lib/constants/ownership-sources.js";
  import {
    GAME_STATUS_SEG_ACTIVE as SEG_ACTIVE,
    GAME_STATUS_DESC as STATUS_DESC,
    GAME_STATUS_META as STATUS_META,
    GAME_STATUS_ORDER as STATUS_ORDER,
  } from "#lib/constants/status-labels.js";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import { createEntryTrackingMutations } from "#lib/entry-tracking-mutations.svelte.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { joinMeta } from "#lib/format.js";
  import { gameReleaseLabel, isVagueRelease } from "#lib/game-release.js";
  import { releaseDigestOff } from "#lib/release-alerts.js";
  import Tooltip from "#lib/components/Tooltip.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    GAME_DIRECT_STATUS_TARGETS,
    statusCorrectionLabel,
    cycleAwareStatusCorrections,
  } from "#lib/status-corrections.js";
  import type { GameEntryDto } from "@loomkeep/shared";
  import { slide } from "svelte/transition";
  import GameSagaSection from "./components/GameSagaSection.svelte";
  import GameTimeToBeat from "./components/GameTimeToBeat.svelte";
  import GamePlatformField from "./components/GamePlatformField.svelte";

  // IGDB is the only game source today; the web route carries just the id.
  const SOURCE = "igdb";

  // Brand-ish colors per rating source (no official logos — those are
  // trademarked). Literal classes so Tailwind picks them up.

  let confirmRemove = $state(false);
  let statusEditorOpen = $state(false);
  let historyOpen = $state(false);
  let compact = $state(false);
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
  // 18+ titles never become a card: the friend may not allow them.
  const work = $derived(detail ? gameWork(detail) : null);
  let sharing = $state(false);
  const error = $derived(
    adultBlocked ? m.game_adult_restricted() : gameQuery.error,
  );

  const entry = $derived(detail?.entry ?? null);

  // Read here rather than in the saga block: the franchise carousel leaves
  // out the series' games, which the block already lists.
  const sagaKey = $derived(keys.games.saga(id, entry !== null));
  const sagaQuery = createApiQuery(() => ({
    key: sagaKey,
    fetch: () => getGameSaga(id).then((r) => r.saga),
    enabled: !!id,
    keepPreviousData: true,
  }));
  const sagaIds = $derived(
    new Set(sagaQuery.data?.members.map((x) => x.sourceId)),
  );
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
  const galleryImages = $derived(
    detail
      ? buildGallery(detail.title, [
          { src: detail.coverUrl || null },
          { src: detail.backdropUrl || null },
          ...detail.screenshots.map((src) => ({ src })),
        ])
      : [],
  );

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  // Images are offset by one slide when a trailer is shown, since the
  // trailer always sits at index 0 in the lightbox.
  const trailerOffset = $derived(detail?.trailerVideoId ? 1 : 0);

  function openLightbox(url: string | null) {
    if (!url) return;
    lightboxIndex = galleryIndex(galleryImages, url, trailerOffset);
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
      ? cycleAwareStatusCorrections(
          STATUS_ORDER,
          entry.status,
          GAME_DIRECT_STATUS_TARGETS[entry.status],
          "BACKLOG",
          entry.playthroughs,
        )
      : [],
  );

  const correctionLabel = $derived(
    statusCorrectionLabel(statusCorrections, m.game_status_reset_backlog()),
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
  <WorkHero
    title={detail.title}
    backdropUrl={detail.backdropUrl || null}
    coverUrl={detail.coverUrl || null}
    backHref="/app/games"
    backLabel={m.common_Games()}
    onTrailer={detail.trailerVideoId ? openTrailer : undefined}
    onEnlargeCover={() => openLightbox(detail?.coverUrl ?? null)}
    onCompactChange={(value) => (compact = value)}>
    {#snippet pills()}
      <span
        class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
        {m.game_type()}
      </span>
      {#if upcoming}
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-white backdrop-blur"
          ><Icon
            name="calendar"
            class="h-3.5 w-3.5" />{m.media_upcoming()}</span>
      {:else if entry}
        <TrackingStatusBadge domain="GAMES" status={entry.status} onImage />
      {/if}
      {#if detail.isAdult}
        <span
          class="bg-danger/80 rounded-full px-2.5 py-0.5 text-xs font-bold text-white">
          18+
        </span>
      {/if}
      {#each detail.ageRatingImageUrls as url (url)}
        <img src={url} alt={m.game_age_rating()} class="h-6 rounded" />
      {/each}
    {/snippet}
    <p class="timecode mt-1.5 text-sm text-white/80">
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
        <p class="mt-1 text-sm text-white/80 tabular-nums">{release}</p>
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
            workImageUrl={detail.coverUrl}
            overlay />
        {/if}
        <ExternalRatingChips ratings={detail.ratings} overlay />
      </div>
    {/if}
  </WorkHero>

  <WorkActionBar
    tracked={!!entry}
    status={entry ? STATUS_META[entry.status].label : undefined}
    statusTone={entry?.status === "DROPPED"
      ? "danger"
      : entry?.status === "COMPLETED"
        ? "success"
        : "accent"}
    {compact}
    title={detail.title}
    {saving}
    favorite={entry?.favorite}
    listTarget={entry ? { type: "GAME", id: entry.game.id } : undefined}
    actions={!entry || upcoming
      ? []
      : [
          ...(entry.status === "PLAYING"
            ? [
                {
                  label: m.game_status_mark_completed(),
                  icon: "check" as const,
                  onSelect: () => patchMut.mutate({ status: "COMPLETED" }),
                },
                {
                  label: m.game_status_drop(),
                  icon: "archive" as const,
                  onSelect: () => patchMut.mutate({ status: "DROPPED" }),
                },
              ]
            : []),
          ...(entry.status === "DROPPED"
            ? [
                {
                  label: m.game_status_resume(),
                  icon: "refresh" as const,
                  onSelect: () => patchMut.mutate({ status: "PLAYING" }),
                },
              ]
            : []),
          ...(correctionLabel
            ? [
                {
                  label: correctionLabel,
                  icon: "edit" as const,
                  separator: true,
                  onSelect: openStatusCorrection,
                },
              ]
            : []),
        ]}
    onAdd={() => addMut.mutate()}
    onToggleFavorite={() =>
      entry && patchMut.mutate({ favorite: !entry.favorite })}
    onShare={() => (sharing = true)}
    onRemove={() => (confirmRemove = true)}>
    {#snippet socialActions()}
      {#if appConfig.socialEnabled && detail.commentTargetId}
        <CommentsPanel
          targetType="GAME"
          targetId={detail.commentTargetId}
          title={detail.title}
          canParticipate={!!entry}
          revealSpoilersByDefault={entry?.status === "COMPLETED"}
          compact />
      {/if}
    {/snippet}
  </WorkActionBar>

  <!-- Desktop: the work's details in a column beside the page, as before;
       a phone gets them right after "My tracking". -->
  <div
    class="mx-auto max-w-5xl px-5 pb-6 md:grid md:grid-cols-[minmax(0,1fr)_17rem] md:items-start md:gap-x-10 md:px-8 md:pb-10">
    <div class="min-w-0">
      {#if appConfig.socialEnabled && detail.commentTargetId}
        <WorkFriendsStrip
          domain="GAMES"
          targetType="GAME"
          targetId={detail.commentTargetId}
          revision={`${entry?.status}:${entry?.playtimeMinutes}`} />
      {/if}

      {#if entry}
        <div class="mt-6 max-w-xl">
          {#if upcoming}
            {@render releaseReminder(entry)}
          {:else}
            <GameSessionDock
              {entry}
              {detailKey}
              averageMinutes={detail.timeToBeat?.normallyMin ?? null} />
          {/if}
        </div>
      {/if}

      {#if detail.platforms.length > 0}
        <div class="mt-6 flex flex-wrap gap-1.5">
          {#each detail.platforms as platform (platform)}
            <span class="bg-surface-2 text-dim rounded-md px-2 py-0.5 text-xs">
              {platform}
            </span>
          {/each}
        </div>
      {/if}

      {#if detail.overview}
        <div class="mt-6 max-w-2xl">
          <ClampedText
            text={detail.overview}
            lines={layout.compact ? 3 : 8}
            class="text-dim whitespace-pre-line" />
        </div>
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

      {#if entry && !upcoming}
        <WorkTrackingFold summary={m.game_tracking_summary()}>
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
          {#if detail.platforms.length > 0}
            <GamePlatformField
              platform={entry.platform}
              platforms={detail.platforms}
              onChange={(platform) => patchMut.mutate({ platform })} />
          {/if}
          <NoteField
            value={entry.notes}
            placeholder={m.game_note_placeholder()}
            onChange={(v) => patchMut.mutate({ notes: v })} />
        </WorkTrackingFold>
      {/if}

      {#if hasSidePanels}
        <div class="mt-8 md:hidden">
          {@render sidePanels()}
        </div>
      {/if}

      {#if sagaQuery.data}
        <GameSagaSection
          saga={sagaQuery.data}
          {sagaKey}
          sourceId={detail.sourceId}
          entryStatus={entry?.status ?? null} />
      {/if}

      <RelatedCarousel
        title={detail.franchiseName
          ? m.game_franchise_title({ name: detail.franchiseName })
          : m.game_same_franchise()}
        items={toCarouselItems(
          detail.franchiseGames.filter((g) => !sagaIds.has(g.sourceId)),
          "/app/games",
        )} />

      <RelatedCarousel
        title={m.media_similar_titles()}
        items={toCarouselItems(detail.similarGames, "/app/games")} />

      <WorkSocialSection
        targetType="GAME"
        reviewTargetId={entry && !upcoming ? entry.game.id : null}
        commentTargetId={detail.commentTargetId}
        title={detail.title}
        meta={reviewMeta}
        imageUrl={detail.coverUrl}
        canParticipate={!!entry} />

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
    </div>
    {#if hasSidePanels}
      <aside class="hidden md:sticky md:top-20 md:mt-6 md:block">
        {@render sidePanels()}
      </aside>
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
          <p class={digestOff ? "text-dim" : ""}>
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
      <p class="text-dim text-xs">{m.game_upcoming_tracking_hint()}</p>
    </div>
  {/snippet}

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
    <DetailsCard>
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
    </DetailsCard>
  {/snippet}

  {#if sharing && work}
    <ShareWorkModal
      {work}
      sendable={!detail?.isAdult}
      onclose={() => (sharing = false)} />
  {/if}

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
    <StatusCorrectionModal
      onclose={() => (statusEditorOpen = false)}
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
