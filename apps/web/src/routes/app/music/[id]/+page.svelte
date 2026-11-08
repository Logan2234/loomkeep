<script lang="ts">
  import { fade } from "svelte/transition";
  import { buildGallery, galleryIndex } from "#lib/gallery.js";

  import DetailsCard from "#lib/components/DetailsCard.svelte";
  import WorkSocialSection from "#lib/components/WorkSocialSection.svelte";
  import { page } from "$app/state";
  import {
    deleteMusicEntry,
    getMusicDetail,
    updateMusicEntry,
    upsertMusicEntry,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { goBack } from "#lib/back-nav.svelte.js";
  import { toCarouselItems } from "#lib/carousel.js";
  import Banner from "#lib/components/Banner.svelte";
  import WorkFriendsStrip from "#lib/components/WorkFriendsStrip.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import ConfirmationModal from "#lib/components/ConfirmationModal.svelte";
  import DetailHeroSkeleton from "#lib/components/DetailHeroSkeleton.svelte";
  import TrackingStatusBadge from "#lib/components/TrackingStatusBadge.svelte";
  import Lightbox from "#lib/components/Lightbox.svelte";
  import MyRatingBadge from "#lib/components/MyRatingBadge.svelte";
  import NoteField from "#lib/components/NoteField.svelte";
  import OwnershipField from "#lib/components/OwnershipField.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import RelatedCarousel from "#lib/components/RelatedCarousel.svelte";

  import SegmentedStatusControl from "#lib/components/SegmentedStatusControl.svelte";
  import CommentsPanel from "#lib/components/CommentsPanel.svelte";
  import WorkActionBar from "#lib/components/work/WorkActionBar.svelte";
  import WorkHero from "#lib/components/work/WorkHero.svelte";
  import WorkTrackingFold from "#lib/components/work/WorkTrackingFold.svelte";
  import ShareWorkModal from "#lib/components/ShareWorkModal.svelte";
  import { musicWork } from "#lib/chat/work-search.js";

  import {
    MUSIC_OWNERSHIP_SOURCES,
    MUSIC_OWNERSHIP_STATUS_OPTIONS,
  } from "#lib/constants/ownership-sources.js";
  import {
    MUSIC_STATUS_SEG_ACTIVE as SEG_ACTIVE,
    MUSIC_STATUS_DESC as STATUS_DESC,
    MUSIC_STATUS_META as STATUS_META,
    MUSIC_STATUS_ORDER as STATUS_ORDER,
  } from "#lib/constants/status-labels.js";
  import { createEntryTrackingMutations } from "#lib/entry-tracking-mutations.svelte.js";
  import { MONTH_YEAR_OPTIONS, formatDate, joinMeta } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";

  // MusicBrainz is the only music source today; the web route carries just the id.
  const SOURCE = "musicbrainz";

  let confirmRemove = $state(false);
  let compact = $state(false);
  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  const id = $derived(page.params.id ?? "");
  const TAGS_SHOWN = 5;
  let tagsOpen = $state(false);
  const detailKey = $derived(keys.music.detail(SOURCE, id));

  const musicQuery = createApiQuery(() => ({
    key: detailKey,
    fetch: () => getMusicDetail(SOURCE, id),
    enabled: !!id,
  }));
  const detail = $derived(musicQuery.data);
  const work = $derived(detail ? musicWork(detail) : null);
  let sharing = $state(false);
  const error = $derived(musicQuery.error);

  const entry = $derived(detail?.entry ?? null);
  const reviewMeta = $derived(
    detail ? joinMeta(detail.artists.join(", "), detail.year) : "",
  );

  // Precise release date, respecting the source's actual precision — a
  // year-only date must not be shown as if it were "1 janvier".
  const releaseDateLabel = $derived.by(() => {
    if (!detail?.releaseDate) return null;
    if (detail.releaseDatePrecision === "day") {
      return formatDate(detail.releaseDate);
    }
    if (detail.releaseDatePrecision === "month") {
      return formatDate(detail.releaseDate, MONTH_YEAR_OPTIONS);
    }
    return null;
  });

  const hasMeta = $derived(
    !!detail &&
      (detail.tags.length > 0 ||
        detail.externalLinks.length > 0 ||
        !!detail.label ||
        !!detail.catalogNumber),
  );

  // Front cover + any archived extras (back, booklet…), for one lightbox gallery.
  const galleryImages = $derived(
    detail
      ? buildGallery(
          detail.title,
          [
            { src: detail.coverUrl || null },
            ...detail.extraCoverImages.map((image) => ({
              src: image.url,
              alt: `${detail.title} — ${image.type}`,
            })),
          ],
          false,
        )
      : [],
  );

  function openLightbox(url: string | null) {
    if (!url) return;
    lightboxIndex = galleryIndex(galleryImages, url);
    lightboxOpen = true;
  }

  function formatTrackDuration(ms: number): string {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function formatTotalDuration(ms: number): string {
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
  }

  const { addMut, patchMut, removeMut } = createEntryTrackingMutations({
    detailKey: () => detailKey,
    detail: () => detail,
    entryId: () => entry?.id,
    upsert: (d) =>
      upsertMusicEntry({
        source: d.source,
        sourceId: d.sourceId,
        status: "TO_LISTEN",
      }),
    update: (id, changes: Parameters<typeof updateMusicEntry>[1]) =>
      updateMusicEntry(id, changes),
    remove: (id) => deleteMusicEntry(id),
    onRemoveSuccess: () => (confirmRemove = false),
  });

  const saving = $derived(addMut.loading || patchMut.loading);
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
    <a href="/app/music" onclick={goBack} class="btn btn-ghost mt-4"
      >← {m.common_Music()}</a>
  </div>
{/if}

{#if detail}
  <WorkHero
    title={detail.title}
    backdropUrl={null}
    coverUrl={detail.coverUrl || null}
    square
    backHref="/app/music"
    backLabel={m.common_Music()}
    onEnlargeCover={() => openLightbox(detail?.coverUrl ?? null)}
    onCompactChange={(value) => (compact = value)}>
    {#snippet pills()}
      <span
        class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
        {detail.albumType ?? m.music_album()}
      </span>
      {#if entry}
        <TrackingStatusBadge domain="MUSIC" status={entry.status} onImage />
      {/if}
    {/snippet}
    {#if detail.artists.length > 0}
      <p class="font-display mt-1.5 font-semibold text-white/90">
        {detail.artists.join(", ")}
      </p>
    {/if}
    {#if detail.disambiguation}
      <p class="mt-0.5 text-sm text-white/70 italic">
        {detail.disambiguation}
      </p>
    {/if}
    <p class="timecode mt-1.5 text-sm text-white/80">
      {#if releaseDateLabel}
        {releaseDateLabel}
      {:else if detail.year}
        {detail.year}
      {/if}
      {#if detail.genres.length > 0}
        {#if releaseDateLabel || detail.year}·{/if}
        {detail.genres.slice(0, 3).join(", ")}
      {/if}
    </p>
    {#if entry}
      <div class="mt-2.5 flex">
        <MyRatingBadge
          targetType="MUSIC"
          targetId={entry.album.id}
          workTitle={detail.title}
          workMeta={reviewMeta}
          workImageUrl={detail.coverUrl}
          overlay />
      </div>
    {/if}
  </WorkHero>

  <WorkActionBar
    tracked={!!entry}
    status={entry ? STATUS_META[entry.status].label : undefined}
    {compact}
    title={detail.title}
    {saving}
    favorite={entry?.favorite}
    listTarget={entry ? { type: "MUSIC", id: entry.album.id } : undefined}
    onAdd={() => addMut.mutate()}
    onToggleFavorite={() =>
      entry && patchMut.mutate({ favorite: !entry.favorite })}
    onShare={() => (sharing = true)}
    onRemove={() => (confirmRemove = true)}>
    {#snippet socialActions()}
      {#if appConfig.socialEnabled && detail.commentTargetId}
        <CommentsPanel
          targetType="MUSIC"
          targetId={detail.commentTargetId}
          title={detail.title}
          canParticipate={!!entry}
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
          domain="MUSIC"
          targetType="MUSIC"
          targetId={detail.commentTargetId}
          revision={entry?.status ?? ""} />
      {/if}

      {#if entry}
        <div class="mt-6 max-w-xl">
          <SegmentedStatusControl
            statuses={STATUS_ORDER}
            current={entry.status}
            disabled={saving}
            meta={STATUS_META}
            desc={STATUS_DESC}
            activeClass={SEG_ACTIVE}
            onSelect={(status) => patchMut.mutate({ status })} />
        </div>
      {/if}

      {#if detail.tracks.length > 0}
        <div class="mt-8">
          <div class="mb-3 flex items-baseline justify-between">
            <h2 class="font-display text-lg font-bold">{m.music_tracks()}</h2>
            {#if detail.totalDurationMs !== null}
              <span class="timecode text-xs">
                {formatTotalDuration(detail.totalDurationMs)}
              </span>
            {/if}
          </div>
          <ol class="card divide-border divide-y">
            {#each detail.tracks as track (track.position)}
              <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span class="timecode text-dim w-6 shrink-0 text-right">
                  {track.position}
                </span>
                <span class="min-w-0 flex-1 truncate">{track.title}</span>
                {#if track.durationMs !== null}
                  <span class="timecode shrink-0 text-xs">
                    {formatTrackDuration(track.durationMs)}
                  </span>
                {/if}
              </li>
            {/each}
          </ol>
        </div>
      {/if}

      {#if entry}
        <WorkTrackingFold summary={m.media_tracking_summary()}>
          <OwnershipField
            status={entry.ownershipStatus}
            source={entry.ownershipSource}
            statusOptions={MUSIC_OWNERSHIP_STATUS_OPTIONS}
            sourceOptionsByStatus={MUSIC_OWNERSHIP_SOURCES}
            onChange={(status, source) =>
              patchMut.mutate({
                ownershipStatus: status as typeof entry.ownershipStatus,
                ownershipSource: source,
              })} />
          <NoteField
            value={entry.notes}
            placeholder={m.music_note_placeholder()}
            onChange={(v) => patchMut.mutate({ notes: v })} />
        </WorkTrackingFold>
      {/if}

      {#if hasMeta}
        <div class="mt-8 md:hidden">
          {@render detailsPanel()}
        </div>
      {/if}

      {#if detail.extraCoverImages.length > 0}
        <div class="mt-8">
          <h2 class="font-display mb-3 text-lg font-bold">
            {m.music_artwork()}
          </h2>
          <div class="flex flex-wrap gap-3">
            {#each detail.extraCoverImages as img (img.url)}
              <button
                type="button"
                class="border-border hover:border-accent w-20 shrink-0 overflow-hidden rounded-lg border shadow-sm transition-colors"
                aria-label={m.music_enlarge_artwork({ type: img.type })}
                onclick={() => openLightbox(img.url)}>
                <Poster
                  src={img.url}
                  title={`${detail.title} — ${img.type}`}
                  alt="" />
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <RelatedCarousel
        title={m.music_same_artist()}
        items={toCarouselItems(detail.sameArtistAlbums, "/app/music")} />

      <WorkSocialSection
        targetType="MUSIC"
        reviewTargetId={entry?.album.id ?? null}
        commentTargetId={detail.commentTargetId}
        title={detail.title}
        meta={reviewMeta}
        imageUrl={detail.coverUrl}
        canParticipate={!!entry} />
    </div>
    {#if hasMeta}
      <aside class="hidden md:sticky md:top-20 md:mt-6 md:block">
        {@render detailsPanel()}
      </aside>
    {/if}
  </div>

  {#snippet detailsPanel()}
    <DetailsCard>
      {#if detail && detail.label}
        <div>
          <dt class="timecode text-xs">{m.music_label()}</dt>
          <dd class="mt-0.5 text-sm">{detail.label}</dd>
        </div>
      {/if}
      {#if detail && detail.catalogNumber}
        <div>
          <dt class="timecode text-xs">{m.music_catalog_number()}</dt>
          <dd class="mt-0.5 text-sm">{detail.catalogNumber}</dd>
        </div>
      {/if}
      {#if detail && detail.tags.length > 0}
        <div>
          <dt class="timecode text-xs">{m.music_tags()}</dt>
          <dd class="mt-1.5 flex flex-wrap gap-1.5">
            {#each tagsOpen ? detail.tags : detail.tags.slice(0, TAGS_SHOWN) as tag (tag)}
              <span
                in:fade={{ duration: tagsOpen ? 150 : 0 }}
                class="bg-surface-2 text-dim rounded-md px-2 py-0.5 text-xs">
                {tag}
              </span>
            {/each}
            {#if !tagsOpen && detail.tags.length > TAGS_SHOWN}
              <button
                type="button"
                class="btn-text px-2"
                onclick={() => (tagsOpen = true)}>
                {m.common_view_all_count({ count: detail.tags.length })}
              </button>
            {/if}
          </dd>
        </div>
      {/if}
      {#if detail && detail.externalLinks.length > 0}
        <div>
          <dt class="timecode text-xs">{m.common_links()}</dt>
          <dd class="mt-1.5 flex flex-wrap gap-2">
            {#each detail.externalLinks as link (link.url)}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                class="border-border text-dim hover:border-accent hover:text-accent rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors">
                {link.label} ↗
              </a>
            {/each}
          </dd>
        </div>
      {/if}
    </DetailsCard>
  {/snippet}

  {#if sharing && work}
    <ShareWorkModal {work} sendable={true} onclose={() => (sharing = false)} />
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

  {#if lightboxOpen && galleryImages.length > 0}
    <Lightbox
      images={galleryImages}
      bind:index={lightboxIndex}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <DetailHeroSkeleton />
{/if}
