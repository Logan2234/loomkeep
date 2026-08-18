<script lang="ts">
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
    watchEpisode,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import CommentThread from "$lib/components/CommentThread.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import DetailHeroSkeleton from "$lib/components/DetailHeroSkeleton.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Lightbox from "$lib/components/Lightbox.svelte";
  import NoteField from "$lib/components/NoteField.svelte";
  import OwnershipField from "$lib/components/OwnershipField.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import ProviderMark from "$lib/components/ProviderMark.svelte";
  import RelatedCarousel from "$lib/components/RelatedCarousel.svelte";
  import ReviewsSection from "$lib/components/ReviewsSection.svelte";
  import { appConfig } from "$lib/config.svelte";
  import {
    MEDIA_OWNERSHIP_SOURCES,
    MEDIA_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/constants/ownership-sources";
  import { formatDate } from "$lib/format";
  import { goBack } from "$lib/backNav.svelte";
  import { createLibraryEntryActions } from "$lib/library-entry";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    EntryStatus,
    MediaDetailDto,
    MediaExtrasDto,
    MediaType,
  } from "@loomkeep/shared";
  import { isDormant } from "@loomkeep/shared";
  import ActionBar from "./components/ActionBar.svelte";
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
    PLANNED: { label: "À voir", cls: "bg-white/15 text-white" },
    WATCHING: { label: "En cours", cls: "bg-accent text-accent-fg" },
    UP_TO_DATE: {
      label: "À jour",
      cls: "border border-success text-success",
    },
    COMPLETED: { label: "Terminé", cls: "bg-success/80 text-white" },
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

  // Once the hero has scrolled behind the sticky action bar, it grows a
  // compact title so the viewer never loses track of which work they're on.
  let heroEnd = $state<HTMLDivElement>();
  let compact = $state(false);

  $effect(() => {
    const el = heroEnd;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([e]) => (compact = !e.isIntersecting),
      { rootMargin: "-65px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  });

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
            err instanceof ApiError
              ? err.message
              : m.common_fetch_error_fallback();
        }
      });
  });

  const { reload, add, patch, doRemove, addReplay, removeReplay } =
    createLibraryEntryActions(
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
        addReplay: addLibraryReplay,
        removeReplay: deleteLibraryReplay,
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

  // IMDb/RT/Metacritic scores are fetched through OMDb, whose CC BY-NC 4.0
  // license requires attribution wherever that content is displayed.
  const hasOmdbRatings = $derived(
    (extras?.ratings ?? []).some((r) =>
      ["IMDb", "RT", "Metacritic"].includes(r.source),
    ),
  );

  const entry = $derived(detail?.entry ?? null);
  const isMovie = $derived(detail?.type === "MOVIE");
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

  // Powers the action bar's "Continuer" shortcut only — the episode
  // accordion (EpisodesSection) has its own copy for its per-row actions.
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

  function continueWatching() {
    const next = entry?.progress?.nextEpisode;
    if (!next) return;
    void markNextWatched(next.episodeId);
  }

  function toggleFavorite() {
    if (!entry) return;
    patch({ favorite: !entry.favorite });
  }

  // Movies: a single seen/not-seen toggle stands in for progress.
  function toggleWatched() {
    if (!entry) return;
    patch({ status: entry.status === "COMPLETED" ? "PLANNED" : "COMPLETED" });
  }

  function dropEntry() {
    patch({ status: "DROPPED" });
  }

  function resumeEntry() {
    patch({ status: "WATCHING" });
  }
</script>

{#if error}
  <div class="mx-auto max-w-4xl px-5 py-6 md:px-8">
    <Banner variant="error">{error}</Banner>
  </div>
{/if}

{#if detail}
  <!-- Hero: full-bleed backdrop, title/meta/ratings overlaid, poster tucked
       in the corner. Text stays white regardless of theme — it sits on a
       photo, not on the page background. -->
  <div class="relative h-[64vh] max-h-[620px] min-h-[420px]">
    {#if detail.backdropUrl}
      <img src={detail.backdropUrl} alt="" class="h-full w-full object-cover" />
    {:else}
      <div class="from-surface-2 to-surface h-full w-full bg-linear-to-br">
      </div>
    {/if}
    <div
      class="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent">
    </div>
    <a
      href="/app/media"
      onclick={goBack}
      class="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur hover:bg-black/55">
      ← Vidéo
    </a>

    {#if detail.posterUrl}
      <button
        type="button"
        class="absolute right-4 bottom-4 z-10 w-20 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-white/20 shadow-lg md:right-6 md:bottom-6 md:w-24"
        aria-label="Agrandir l'affiche"
        onclick={() => openLightbox(detail?.posterUrl ?? null)}>
        <Poster src={detail.posterUrl} title={detail.title} />
      </button>
    {/if}

    <div class="absolute inset-x-0 bottom-0">
      <div class="mx-auto max-w-4xl px-5 pb-6 md:px-8 md:pb-8">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
            {TYPE_LABELS[detail.type]}
          </span>
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
                class="rounded-full border border-white/30 px-2.5 py-0.5 text-xs font-bold text-white">
                ⏸ En pause
              </span>
            {/if}
          {/if}
          {#if detail.isAdult}
            <span
              class="bg-danger/80 rounded-full px-2.5 py-0.5 text-xs font-bold text-white">
              18+
            </span>
          {/if}
        </div>
        <h1
          class="font-display mt-2 text-3xl font-extrabold tracking-tight text-balance text-white text-shadow-[0_2px_24px_rgba(0,0,0,.5)] md:text-4xl">
          {detail.title}
        </h1>
        <p class="timecode mt-1.5 text-sm text-white/80">
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
                ] ?? 'bg-white/15 text-white'} {r.url
                  ? 'transition-opacity hover:opacity-80'
                  : ''}">
                <span>{r.source}</span>
                <span class="tabular-nums opacity-90">{r.score}</span>
              </svelte:element>
            {/each}
          </div>
          {#if hasOmdbRatings}
            <a
              href="https://www.omdbapi.com/"
              target="_blank"
              rel="noopener noreferrer"
              class="text-dim mt-1 block text-[0.6rem] hover:underline">
              {m.media_omdb_notice()}
            </a>
          {/if}
        {/if}
      </div>
    </div>
  </div>

  <div bind:this={heroEnd}></div>

  <ActionBar
    {entry}
    {isMovie}
    {saving}
    {compact}
    title={detail.title}
    nextEpisode={entry?.progress?.nextEpisode ?? null}
    continuing={continuingEpisodeId !== null}
    onAdd={add}
    onToggleFavorite={toggleFavorite}
    onContinue={continueWatching}
    onToggleWatched={toggleWatched}
    onDrop={dropEntry}
    onResume={resumeEntry}
    onRemove={() => (confirmRemove = true)} />

  <div class="mx-auto max-w-4xl px-5 pb-6 md:px-8 md:pb-10">
    {#if entry?.progress}
      <div class="mt-6 max-w-sm">
        <div class="bg-surface-2 h-1.5 overflow-hidden rounded-full">
          <div class="bg-accent h-full" style={`width: ${pct}%`}></div>
        </div>
        <p class="timecode mt-1.5 text-sm">
          {entry.progress.watchedEpisodes} / {entry.progress.totalEpisodes} épisodes
          vus · {pct} %
        </p>
      </div>
    {/if}

    {#if detail.overview}
      <p class="text-dim mt-6 max-w-2xl">{detail.overview}</p>
    {/if}

    {#if entry}
      <!-- Set-once settings, not day-to-day actions — tucked away closed by
           default rather than living in the action bar above. -->
      <details
        class="border-border bg-surface group mt-6 max-w-xl overflow-hidden rounded-xl border">
        <summary
          class="group-open:border-border flex cursor-pointer items-center gap-2 px-4 py-3 group-open:border-b [&::-webkit-details-marker]:hidden">
          <Icon
            name="chevron-right"
            class="text-dim h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
          <span class="text-sm font-semibold">Mon suivi</span>
          <span class="text-dim text-xs">Note privée · Possession</span>
        </summary>
        <div class="flex flex-col gap-4 px-4 py-4">
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

          <NoteField
            value={entry.notes}
            placeholder="Une réplique, un souvenir…"
            onChange={(v) => patch({ notes: v })} />

          {#if isMovie && (entry.status === "COMPLETED" || entry.replays.length > 0)}
            <hr class="border-border" />

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <span
                  class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
                  Revisionnages{#if entry.replays.length > 0}
                    &nbsp;· {entry.replays.length}{/if}
                </span>
                {#if entry.status === "COMPLETED"}
                  <button
                    type="button"
                    class="link-accent text-xs disabled:opacity-50"
                    disabled={saving}
                    onclick={addReplay}>
                    + J'ai revu ce film
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
                        aria-label="Supprimer ce revisionnage"
                        disabled={saving}
                        onclick={() => removeReplay(replay.id)}>
                        Supprimer
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </div>
      </details>
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
        {#if extras.watchProviders.link}
          <a
            href={extras.watchProviders.link}
            target="_blank"
            rel="noopener noreferrer"
            class="timecode text-dim hover:text-accent w-full text-[0.6rem] hover:underline">
            Voir sur TMDB · France
          </a>
        {:else}
          <span class="timecode text-dim w-full text-[0.6rem]">France</span>
        {/if}
      </section>
    {/if}

    <!-- Provider attribution: required for TMDB (logo + non-endorsement
         notice, less prominent than Loomkeep's own branding), courtesy for
         AniList. -->
    <p class="text-dim mt-4 flex items-center gap-1.5 text-[0.6rem]">
      <ProviderMark
        brand={type === "ANIME" ? "anilist" : "tmdb"}
        class="h-3 w-3 shrink-0 opacity-70" />
      {type === "ANIME" ? m.media_anilist_notice() : m.media_tmdb_notice()}
    </p>

    <!-- Episodes (series/anime). Watch actions only once the media is tracked. -->
    {#if !isMovie && detail.seasons.length > 0}
      <EpisodesSection
        seasons={orderedSeasons}
        {entry}
        {reload}
        onError={(m) => (error = m)} />
    {/if}

    {#if entry}
      <ReviewsSection
        targetType="MEDIA"
        targetId={entry.mediaItem.id}
        workTitle={detail.title} />
      {#if appConfig.socialEnabled}
        <CommentThread
          targetType="MEDIA"
          targetId={entry.mediaItem.id}
          digest />
      {/if}
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
          href: `/app/media/${s.type.toLowerCase()}/${s.sourceId}`,
          cover: s.posterUrl,
          title: s.title,
        }))} />
    {/if}
  </div>

  {#if confirmRemove}
    <ConfirmationModal
      title="Retirer de ma bibliothèque"
      message={`Retirer « ${detail.title} » de ta bibliothèque ? Ta progression, tes visionnages, ta critique, tes commentaires et ta note seront supprimés.`}
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
