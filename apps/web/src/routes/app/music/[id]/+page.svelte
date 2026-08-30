<script lang="ts">
  import { page } from "$app/state";
  import {
    deleteMusicEntry,
    getMusicDetail,
    updateMusicEntry,
    upsertMusicEntry,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { goBack } from "$lib/backNav.svelte";
  import { toCarouselItems } from "$lib/carousel";
  import AddToListButton from "$lib/components/AddToListButton.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import CommentThread from "$lib/components/CommentThread.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import DetailHeroSkeleton from "$lib/components/DetailHeroSkeleton.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Lightbox from "$lib/components/Lightbox.svelte";
  import NoteField from "$lib/components/NoteField.svelte";
  import OwnershipField from "$lib/components/OwnershipField.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import RelatedCarousel from "$lib/components/RelatedCarousel.svelte";
  import ReviewsSection from "$lib/components/ReviewsSection.svelte";
  import SegmentedStatusControl from "$lib/components/SegmentedStatusControl.svelte";
  import TrackingPanel from "$lib/components/TrackingPanel.svelte";
  import { appConfig } from "$lib/config.svelte";
  import {
    MUSIC_OWNERSHIP_SOURCES,
    MUSIC_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/constants/ownership-sources";
  import {
    MUSIC_STATUS_SEG_ACTIVE as SEG_ACTIVE,
    MUSIC_STATUS_DESC as STATUS_DESC,
    MUSIC_STATUS_META as STATUS_META,
    MUSIC_STATUS_ORDER as STATUS_ORDER,
  } from "$lib/constants/status-labels";
  import { MONTH_YEAR_OPTIONS, formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";

  // MusicBrainz is the only music source today; the web route carries just the id.
  const SOURCE = "musicbrainz";

  let confirmRemove = $state(false);
  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  const id = $derived(page.params.id ?? "");
  const detailKey = $derived(keys.music.detail(SOURCE, id));

  const musicQuery = createApiQuery(() => ({
    key: detailKey,
    fetch: () => getMusicDetail(SOURCE, id),
    enabled: !!id,
  }));
  const detail = $derived(musicQuery.data);
  const error = $derived(musicQuery.error);

  const entry = $derived(detail?.entry ?? null);

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
  const galleryImages = $derived.by(() => {
    if (!detail) return [];
    const images: { src: string; alt: string }[] = [];
    if (detail.coverUrl)
      images.push({ src: detail.coverUrl, alt: detail.title });
    for (const img of detail.extraCoverImages) {
      images.push({ src: img.url, alt: `${detail.title} — ${img.type}` });
    }
    return images;
  });

  function openLightbox(url: string | null) {
    if (!url) return;
    const i = galleryImages.findIndex((img) => img.src === url);
    lightboxIndex = i >= 0 ? i : 0;
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

  const addMut = createApiMutation(() => ({
    mutate: () => {
      const d = detail!;
      return upsertMusicEntry({
        source: d.source,
        sourceId: d.sourceId,
        status: "TO_LISTEN",
      });
    },
    invalidates: [detailKey],
    errorToast: true,
  }));

  const patchMut = createApiMutation(() => ({
    mutate: (changes: Parameters<typeof updateMusicEntry>[1]) =>
      updateMusicEntry(entry!.id, changes),
    invalidates: [detailKey],
    errorToast: true,
  }));

  const removeMut = createApiMutation(() => ({
    mutate: () => deleteMusicEntry(entry!.id),
    onSuccess: () => {
      confirmRemove = false;
    },
    successToast: m.tracking_removed_toast(),
    invalidates: [detailKey],
    errorToast: true,
  }));

  const saving = $derived(addMut.loading || patchMut.loading);
</script>

{#if error}
  <div class="mx-auto max-w-4xl px-5 py-6 md:px-8">
    <Banner variant="error">{error}</Banner>
    <a href="/app/music" onclick={goBack} class="btn btn-ghost mt-4"
      >← {m.common_Music()}</a>
  </div>
{/if}

{#if detail}
  <!-- Hero: albums have no wide artwork, so a gradient fades into the page. -->
  <div class="relative">
    <div class="from-surface-2 to-surface h-44 w-full bg-linear-to-br md:h-60">
    </div>
    <div
      class="from-bg via-bg/50 absolute inset-0 bg-linear-to-t to-transparent">
    </div>
    <a
      href="/app/music"
      onclick={goBack}
      class="border-border bg-bg/60 hover:bg-bg absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold backdrop-blur">
      ← {m.common_Music()}
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
            <Poster src={detail.coverUrl} title={detail.title} />
          </button>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="bg-surface-2 text-dim rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {detail.albumType ?? m.music_album()}
              </span>
              {#if entry}
                <span
                  title={STATUS_DESC[entry.status]}
                  class="rounded-full px-2.5 py-0.5 text-xs font-bold {STATUS_META[
                    entry.status
                  ].cls}">
                  {STATUS_META[entry.status].label}
                </span>
              {/if}
            </div>
            <h1
              class="font-display mt-2 text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
              {detail.title}
            </h1>
            {#if detail.artists.length > 0}
              <p class="font-display text-dim mt-1.5 text-lg font-semibold">
                {detail.artists.join(", ")}
              </p>
            {/if}
            {#if detail.disambiguation}
              <p class="text-dim mt-0.5 text-sm italic">
                {detail.disambiguation}
              </p>
            {/if}
            <p class="timecode mt-1.5 text-sm">
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
          </div>
        </div>

        <!-- Actions -->
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
            onRemove={() => (confirmRemove = true)}>
            <SegmentedStatusControl
              statuses={STATUS_ORDER}
              current={entry.status}
              disabled={saving}
              meta={STATUS_META}
              desc={STATUS_DESC}
              activeClass={SEG_ACTIVE}
              onSelect={(status) => patchMut.mutate({ status })} />

            <AddToListButton targetType="MUSIC" targetId={entry.album.id} />

            <NoteField
              value={entry.notes}
              placeholder={m.music_note_placeholder()}
              onChange={(v) => patchMut.mutate({ notes: v })} />

            <hr class="border-border" />

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
          </TrackingPanel>
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
                    title={`${detail.title} — ${img.type}`} />
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Details panel, mobile position: after the album content, before the carousel. -->
        {#if hasMeta}
          <div class="mt-8 md:hidden">
            {@render detailsPanel()}
          </div>
        {/if}

        <RelatedCarousel
          title={m.music_same_artist()}
          items={toCarouselItems(detail.sameArtistAlbums, "/app/music")} />

        {#if entry}
          <ReviewsSection
            targetType="MUSIC"
            targetId={entry.album.id}
            workTitle={detail.title} />
          {#if appConfig.socialEnabled}
            <CommentThread targetType="MUSIC" targetId={entry.album.id} />
          {/if}
        {/if}
      </div>

      <!-- Details panel, desktop position: sidebar next to the main column. -->
      {#snippet detailsPanel()}
        <div class="card p-4">
          <h2 class="font-display text-sm font-bold tracking-tight">
            {m.common_details()}
          </h2>
          <dl class="mt-3 flex flex-col gap-3">
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
                  {#each detail.tags as tag (tag)}
                    <span
                      class="bg-surface-2 text-dim rounded-md px-2 py-0.5 text-xs">
                      {tag}
                    </span>
                  {/each}
                </dd>
              </div>
            {/if}
            {#if detail && detail.externalLinks.length > 0}
              <div>
                <dt class="timecode text-xs">{m.music_links()}</dt>
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
          </dl>
        </div>
      {/snippet}
      {#if hasMeta}
        <div class="hidden md:block">
          {@render detailsPanel()}
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

  {#if lightboxOpen && galleryImages.length > 0}
    <Lightbox
      images={galleryImages}
      bind:index={lightboxIndex}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <DetailHeroSkeleton />
{/if}
