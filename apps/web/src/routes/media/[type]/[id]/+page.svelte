<script lang="ts">
  import { page } from "$app/state";
  import {
    ApiError,
    deleteLibraryEntry,
    getMediaDetail,
    getMediaExtras,
    updateLibraryEntry,
    upsertLibraryEntry,
    watchEpisode,
  } from "$lib/api/client";
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
  import TrackingPanel from "$lib/components/TrackingPanel.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { createLibraryEntryActions } from "$lib/library-entry";
  import {
    MEDIA_OWNERSHIP_SOURCES,
    MEDIA_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/ownership-sources";
  import type {
    EntryStatus,
    MediaDetailDto,
    MediaExtrasDto,
    MediaType,
  } from "@loomkeep/shared";
  import { isDormant } from "@loomkeep/shared";
  import CastSection from "./components/CastSection.svelte";
  import EpisodesSection from "./components/EpisodesSection.svelte";

  const TYPE_LABELS: Record<MediaType, string> = {
    MOVIE: "Film",
    SERIES: "Série",
    ANIME: "Animé",
  };

  // Effective-status badge: label + chip styling. Statuses are derived server
  // side; here we only present them.
  const STATUS_META: Record<EntryStatus, { label: string; cls: string }> = {
    PLANNED: { label: "À voir", cls: "bg-surface-2 text-dim" },
    WATCHING: { label: "En cours", cls: "bg-accent text-accent-fg" },
    UP_TO_DATE: {
      label: "À jour",
      cls: "border border-success text-success",
    },
    COMPLETED: { label: "Terminé", cls: "bg-success/15 text-success" },
    DROPPED: { label: "Abandonné", cls: "border border-danger text-danger" },
  };

  // Surfaced as a tooltip on the status badge, so each state's meaning is clear.
  const STATUS_DESC: Record<EntryStatus, string> = {
    PLANNED: "Dans ta liste, pas encore commencé.",
    WATCHING: "Tu regardes ce titre en ce moment.",
    UP_TO_DATE:
      "Tu as vu tous les épisodes disponibles ; en attente de nouveaux.",
    COMPLETED: "Tu as terminé ce titre.",
    DROPPED: "Tu as arrêté et ne comptes pas le reprendre.",
  };

  // Brand-ish colors per rating source (no official logos — those are
  // trademarked). Literal classes so Tailwind picks them up.
  const RATING_STYLES: Record<string, string> = {
    IMDb: "bg-[#f5c518] text-black",
    RT: "bg-[#fa320a] text-white",
    Metacritic: "bg-[#66cc33] text-black",
    AniList: "bg-[#02a9ff] text-white",
  };

  let detail = $state<MediaDetailDto | null>(null);
  let error = $state<string | null>(null);
  // Busy flag for the hero's "Continuer" shortcut specifically (the episode
  // accordion tracks its own busy state in EpisodesSection).
  let continuingEpisodeId = $state<string | null>(null);
  let saving = $state(false);
  let confirmRemove = $state(false);
  let removing = $state(false);

  // Poster + backdrop + extras' backdrop gallery (TMDB only), deduped, for the
  // lightbox carousel.
  const galleryImages = $derived.by(() => {
    if (!detail) return [];
    const urls: string[] = [];
    if (detail.posterUrl) urls.push(detail.posterUrl);
    if (detail.backdropUrl && !urls.includes(detail.backdropUrl)) {
      urls.push(detail.backdropUrl);
    }
    for (const img of extras?.images ?? []) {
      if (!urls.includes(img)) urls.push(img);
    }
    return urls.map((src) => ({ src, alt: detail!.title }));
  });

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  function openLightbox(url: string | null) {
    if (!url) return;
    const i = galleryImages.findIndex((img) => img.src === url);
    lightboxIndex = i >= 0 ? i : 0;
    lightboxOpen = true;
  }

  const type = $derived((page.params.type ?? "").toUpperCase() as MediaType);
  const id = $derived(page.params.id ?? "");

  $effect(() => {
    const t = type;
    const i = id;
    if (!t || !i) return;
    error = null;
    detail = null; // Clear stale content so the loader shows on navigation.
    getMediaDetail(t, i)
      .then((result) => (detail = result))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          error =
            "Ce titre est réservé aux comptes ayant activé le contenu pour adultes (réglages).";
        } else {
          error =
            err instanceof ApiError ? err.message : "Chargement impossible";
        }
      });
  });

  const { reload, add, patch, doRemove } = createLibraryEntryActions(
    {
      get detail() {
        return detail;
      },
      set detail(v) {
        detail = v;
      },
      get error() {
        return error;
      },
      set error(v) {
        error = v;
      },
      get saving() {
        return saving;
      },
      set saving(v) {
        saving = v;
      },
      get confirmRemove() {
        return confirmRemove;
      },
      set confirmRemove(v) {
        confirmRemove = v;
      },
      get removing() {
        return removing;
      },
      set removing(v) {
        removing = v;
      },
    },
    {
      load: () => getMediaDetail(type, id),
      add: (d) =>
        upsertLibraryEntry({
          source: d.source,
          sourceId: d.sourceId,
          type: d.type,
          status: "PLANNED",
        }),
      update: updateLibraryEntry,
      remove: deleteLibraryEntry,
      addErrorMessage: "Impossible d'ajouter cet élément à ta bibliothèque",
    },
  );

  // Live extras (where to watch, cast, similar). Loaded once per media (keyed on
  // the route), independent of watch-state reloads. Best-effort: errors are
  // swallowed so a provider hiccup never breaks the page.
  let extras = $state<MediaExtrasDto | null>(null);
  $effect(() => {
    const t = type;
    const i = id;
    extras = null;
    if (!t || !i) return;
    const source = t === "ANIME" ? "anilist" : "tmdb";
    getMediaExtras(source, i, t)
      .then((x) => (extras = x))
      .catch(() => {});
  });

  const hasProviders = $derived(
    !!extras &&
      (extras.watchProviders.flatrate.length > 0 ||
        extras.watchProviders.rent.length > 0 ||
        extras.watchProviders.buy.length > 0),
  );

  const entry = $derived(detail?.entry ?? null);
  const isMovie = $derived(detail?.type === "MOVIE");
  const isOverride = $derived(entry?.status === "DROPPED");
  const dormant = $derived(entry ? isDormant(entry) : false);
  const pct = $derived(
    entry?.progress && entry.progress.totalEpisodes > 0
      ? Math.round(
          (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
        )
      : 0,
  );

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

  // Powers the hero's "Continuer" shortcut only — the episode accordion
  // (EpisodesSection) has its own copy for its per-row/per-season actions.
  async function markNextWatched(episodeId: string) {
    continuingEpisodeId = episodeId;
    error = null;
    try {
      await watchEpisode(episodeId);
      await reload();
    } catch (err) {
      error =
        err instanceof ApiError
          ? err.message
          : "Impossible de marquer comme vu";
    } finally {
      continuingEpisodeId = null;
    }
  }
</script>

{#if error}
  <div class="mx-auto max-w-4xl px-5 py-6 md:px-8">
    <Banner variant="error">{error}</Banner>
  </div>
{/if}

{#if detail}
  <!-- Hero: real backdrop, gradient fallback fading into the page. -->
  <div class="relative">
    {#if detail.backdropUrl}
      <button
        type="button"
        class="block w-full cursor-zoom-in"
        aria-label="Agrandir l'image"
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
    <a
      href="/media"
      class="border-border bg-bg/60 hover:bg-bg absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold backdrop-blur">
      ← Vidéo
    </a>
  </div>

  <!-- relative z-10: the hero above is positioned, so without a stacking
       context here it would paint over the poster pulled up into it. -->
  <div class="relative z-10 mx-auto max-w-4xl px-5 pb-6 md:px-8 md:pb-10">
    <div class="-mt-24 flex flex-col gap-5 sm:flex-row sm:items-end md:-mt-28">
      <button
        type="button"
        class="border-border w-32 shrink-0 overflow-hidden rounded-xl border shadow-lg md:w-44 {detail.posterUrl
          ? 'cursor-zoom-in'
          : ''}"
        aria-label="Agrandir l'image"
        onclick={() => openLightbox(detail?.posterUrl ?? null)}>
        <Poster src={detail.posterUrl} title={detail.title} />
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="bg-surface-2 text-dim rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {TYPE_LABELS[detail.type]}
          </span>
          {#if detail.isAdult}
            <span
              class="bg-danger/15 text-danger rounded-full px-2.5 py-0.5 text-xs font-bold">
              18+
            </span>
          {/if}
          {#if entry}
            <span
              title={STATUS_DESC[entry.status]}
              class="rounded-full px-2.5 py-0.5 text-xs font-bold {STATUS_META[
                entry.status
              ].cls}">
              {STATUS_META[entry.status].label}
            </span>
            {#if dormant}
              <span
                title="Série en cours laissée de côté depuis plus de 30 jours."
                class="border-border text-dim rounded-full border px-2.5 py-0.5 text-xs font-bold">
                ⏸ En pause
              </span>
            {/if}
          {/if}
        </div>
        <h1
          class="font-display mt-2 text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
          {detail.title}
        </h1>
        <p class="timecode mt-1.5 text-sm">
          {#if detail.year}{detail.year}{/if}
          {#if detail.genres.length > 0}
            {#if detail.year}
              ·
            {/if}{detail.genres.slice(0, 3).join(", ")}
          {/if}
          {#if !isMovie && detail.seasons.length > 0}
            · {detail.airingFinished ? "Diffusion terminée" : "En diffusion"}
          {/if}
        </p>

        {#if extras && extras.ratings.length > 0}
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            {#each extras.ratings as r (r.source)}
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
      </div>
    </div>

    {#if entry?.progress}
      <div class="mt-6 max-w-sm">
        <div class="bg-surface-2 h-1.5 overflow-hidden rounded-full">
          <div class="bg-accent h-full" style={`width: ${pct}%`}></div>
        </div>
        <p class="timecode mt-1.5 text-sm">
          {entry.progress.watchedEpisodes} / {entry.progress.totalEpisodes} épisodes
          vus · {pct} %
        </p>
        {#if entry.progress.nextEpisode}
          {@const next = entry.progress.nextEpisode}
          <button
            class="btn btn-primary mt-3"
            disabled={continuingEpisodeId === next.episodeId}
            onclick={() => markNextWatched(next.episodeId)}>
            ▶ Continuer · S{String(next.seasonNumber).padStart(2, "0")}E{String(
              next.episodeNumber,
            ).padStart(2, "0")}
          </button>
        {/if}
      </div>
    {/if}

    {#if detail.overview}
      <p class="text-dim mt-6 max-w-2xl">{detail.overview}</p>
    {/if}

    <!-- Actions -->
    {#if !entry}
      <div class="mt-6">
        <button class="btn btn-primary" disabled={saving} onclick={add}>
          <Icon name="plus" class="h-4 w-4" /> Ajouter à ma bibliothèque
        </button>
      </div>
    {:else}
      <TrackingPanel
        favorite={entry.favorite}
        {saving}
        onToggleFavorite={() => patch({ favorite: !entry.favorite })}
        onRemove={() => (confirmRemove = true)}>
        <!-- Status is derived server-side (shown as a badge in the hero); here
             we only offer the state-changing actions it reacts to. -->
        <div class="flex flex-wrap items-center gap-2.5">
          {#if isMovie}
            <!-- Movies: a single seen/not-seen toggle stands in for progress. -->
            {#if entry.status === "COMPLETED"}
              <button
                class="btn btn-ghost"
                disabled={saving}
                onclick={() => patch({ status: "PLANNED" })}>
                Marquer comme non vu
              </button>
            {:else}
              <button
                class="btn btn-primary"
                disabled={saving}
                onclick={() => patch({ status: "COMPLETED" })}>
                <Icon name="check" class="h-4 w-4" /> Marquer comme vu
              </button>
            {/if}
          {/if}

          {#if isOverride}
            <button
              class="btn btn-ghost"
              disabled={saving}
              onclick={() => patch({ status: "WATCHING" })}>
              Reprendre
            </button>
          {:else}
            <button
              class="btn btn-ghost"
              disabled={saving}
              onclick={() => patch({ status: "DROPPED" })}>
              Abandonner
            </button>
          {/if}

          <AddToListButton targetType="MEDIA" targetId={entry.mediaItem.id} />
        </div>

        <OwnershipField
          status={entry.ownershipStatus}
          source={entry.ownershipSource}
          statusOptions={MEDIA_OWNERSHIP_STATUS_OPTIONS}
          sourceOptionsByStatus={MEDIA_OWNERSHIP_SOURCES}
          onChange={(status, source) =>
            patch({
              ownershipStatus: status as typeof entry.ownershipStatus,
              ownershipSource: source,
            })} />

        <hr class="border-border" />

        <NoteField
          value={entry.notes}
          placeholder="Une réplique, un souvenir…"
          onChange={(v) => patch({ notes: v })} />
      </TrackingPanel>
    {/if}

    {#if hasProviders && extras}
      <!-- Où regarder: deliberately discreet (small, muted logos). -->
      <section class="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span class="timecode text-xs">Où regarder</span>
        {#each [{ label: "Streaming", list: extras.watchProviders.flatrate }, { label: "Location", list: extras.watchProviders.rent }, { label: "Achat", list: extras.watchProviders.buy }] as group (group.label)}
          {#if group.list.length > 0}
            <div class="flex items-center gap-1.5">
              <span class="text-dim text-[0.65rem]">{group.label}</span>
              {#each group.list as p (p.name)}
                <span
                  title={p.name}
                  class="bg-surface-2 grid h-6 w-6 place-items-center overflow-hidden rounded opacity-80">
                  {#if p.logoUrl}
                    <img
                      src={p.logoUrl}
                      alt={p.name}
                      loading="lazy"
                      class="h-full w-full object-cover" />
                  {:else}
                    <span class="text-dim text-[0.55rem] font-bold"
                      >{p.name.slice(0, 2)}</span>
                  {/if}
                </span>
              {/each}
            </div>
          {/if}
        {/each}
        <span class="timecode text-dim w-full text-[0.6rem]"
          >JustWatch · France</span>
      </section>
    {/if}

    <!-- Episodes (series/anime). Watch actions only once the media is tracked. -->
    {#if !isMovie && detail.seasons.length > 0}
      <EpisodesSection
        seasons={orderedSeasons}
        {entry}
        {reload}
        onError={(m) => (error = m)} />
    {/if}

    {#if extras}
      <CastSection
        cast={extras.cast}
        source={type === "ANIME" ? "anilist" : "tmdb"} />
    {/if}

    {#if extras}
      <RelatedCarousel
        title="Titres similaires"
        items={extras.similar.map((s) => ({
          key: `${s.source}:${s.sourceId}`,
          href: `/media/${s.type.toLowerCase()}/${s.sourceId}`,
          cover: s.posterUrl,
          title: s.title,
        }))} />
    {/if}

    {#if entry}
      <ReviewsSection
        targetType="MEDIA"
        targetId={entry.mediaItem.id}
        workTitle={detail.title} />
      {#if appConfig.socialEnabled}
        <CommentThread targetType="MEDIA" targetId={entry.mediaItem.id} />
      {/if}
    {/if}
  </div>

  {#if confirmRemove}
    <ConfirmationModal
      title="Retirer de ma bibliothèque"
      message={`Retirer « ${detail.title} » de ta bibliothèque ? Ta progression, tes visionnages et ta note seront supprimés.`}
      confirmLabel="Retirer"
      danger
      busy={removing}
      onConfirm={doRemove}
      onCancel={() => (confirmRemove = false)} />
  {/if}

  {#if lightboxOpen}
    <Lightbox
      images={galleryImages}
      bind:index={lightboxIndex}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <DetailHeroSkeleton wide={false} />
{/if}
