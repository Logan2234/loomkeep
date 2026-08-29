<script lang="ts">
  import { page } from "$app/state";
  import {
    addGameReplay,
    ApiError,
    deleteGameEntry,
    deleteGameReplay,
    getGameDetail,
    updateGameEntry,
    upsertGameEntry,
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
    GAME_OWNERSHIP_SOURCES,
    GAME_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/constants/ownership-sources";
  import {
    GAME_STATUS_SEG_ACTIVE as SEG_ACTIVE,
    GAME_STATUS_DESC as STATUS_DESC,
    GAME_STATUS_META as STATUS_META,
    GAME_STATUS_ORDER as STATUS_ORDER,
  } from "$lib/constants/status-labels";
  import { formatDate } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { slide } from "svelte/transition";

  // IGDB is the only game source today; the web route carries just the id.
  const SOURCE = "igdb";

  // Brand-ish colors per rating source (no official logos — those are
  // trademarked). Literal classes so Tailwind picks them up.
  const RATING_STYLES: Record<string, string> = {
    IGDB: "bg-[#9147ff] text-white",
    Critiques: "bg-[#66cc33] text-black",
  };

  let confirmRemove = $state(false);
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
    adultBlocked
      ? "Ce jeu est réservé aux comptes ayant activé le contenu pour adultes (réglages)."
      : gameQuery.error,
  );

  const entry = $derived(detail?.entry ?? null);
  const hasMeta = $derived(
    !!detail &&
      (detail.developers.length > 0 ||
        detail.publishers.length > 0 ||
        detail.gameModes.length > 0 ||
        detail.playerPerspectives.length > 0 ||
        detail.multiplayerModes.length > 0),
  );

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

  const addMut = createApiMutation(() => ({
    mutate: () => {
      const d = detail!;
      return upsertGameEntry({
        source: d.source,
        sourceId: d.sourceId,
        status: "BACKLOG",
      });
    },
    invalidates: [detailKey],
    errorToast: true,
  }));

  const patchMut = createApiMutation(() => ({
    mutate: (changes: Parameters<typeof updateGameEntry>[1]) =>
      updateGameEntry(entry!.id, changes),
    invalidates: [detailKey],
    errorToast: true,
  }));

  const removeMut = createApiMutation(() => ({
    mutate: () => deleteGameEntry(entry!.id),
    onSuccess: () => {
      confirmRemove = false;
    },
    successToast: m.tracking_removed_toast(),
    invalidates: [detailKey],
    errorToast: true,
  }));

  const addReplayMut = createApiMutation(() => ({
    mutate: () => addGameReplay(entry!.id),
    invalidates: [detailKey],
    errorToast: true,
  }));

  const removeReplayMut = createApiMutation(() => ({
    mutate: (replayId: string) => deleteGameReplay(replayId),
    invalidates: [detailKey],
    errorToast: true,
  }));

  const saving = $derived(
    addMut.loading ||
      patchMut.loading ||
      addReplayMut.loading ||
      removeReplayMut.loading,
  );
</script>

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
    {#if detail.trailerVideoId}
      <button
        type="button"
        class="absolute top-1/2 left-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
        aria-label="Voir la bande-annonce"
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
            aria-label="Agrandir l'image"
            onclick={() => openLightbox(detail?.coverUrl ?? null)}>
            <Poster src={detail.coverUrl} title={detail.title} />
          </button>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="bg-surface-2 text-dim rounded-full px-2.5 py-0.5 text-xs font-semibold">
                Jeu
              </span>
              {#if detail.isAdult}
                <span
                  class="bg-danger/15 text-danger rounded-full px-2.5 py-0.5 text-xs font-bold">
                  18+
                </span>
              {/if}
              {#each detail.ageRatingImageUrls as url (url)}
                <img src={url} alt="Classification d'âge" class="h-6 rounded" />
              {/each}
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
            <p class="timecode mt-1.5 text-sm">
              {#if detail.year}{detail.year}{/if}
              {#if detail.genres.length > 0}
                {#if detail.year}·{/if}
                {detail.genres.slice(0, 3).join(", ")}
              {/if}
            </p>
            {#if detail.ratings.length > 0}
              <div class="mt-2.5 flex flex-wrap gap-1.5">
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
                Histoire
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

        <!-- Actions -->
        {#if !entry}
          <div class="mt-6">
            <button
              class="btn btn-primary"
              disabled={saving}
              onclick={() => addMut.mutate()}>
              <Icon name="plus" class="h-4 w-4" /> Ajouter à ma bibliothèque
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

            <AddToListButton targetType="GAME" targetId={entry.game.id} />

            <hr class="border-border" />

            <NoteField
              value={entry.notes}
              placeholder="Un boss, une astuce, ta config…"
              onChange={(v) => patchMut.mutate({ notes: v })} />

            <div class="flex items-center justify-between gap-2">
              <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
                Temps de jeu
              </span>
              <div class="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  inputmode="decimal"
                  aria-label="Temps de jeu en heures"
                  class="input w-20 text-right text-sm"
                  disabled={saving}
                  value={Math.round((entry.playtimeMinutes / 60) * 10) / 10}
                  onchange={(e) => {
                    const hours = parseFloat(e.currentTarget.value);
                    if (Number.isFinite(hours) && hours >= 0) {
                      patchMut.mutate({
                        playtimeMinutes: Math.round(hours * 60),
                      });
                    } else {
                      e.currentTarget.value = String(
                        Math.round((entry.playtimeMinutes / 60) * 10) / 10,
                      );
                    }
                  }} />
                <span class="text-dim text-xs">h</span>
              </div>
            </div>

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

            {#if entry.status === "COMPLETED" || entry.replays.length > 0}
              <hr class="border-border" />

              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
                    Relectures{#if entry.replays.length > 0}
                      &nbsp;· {entry.replays.length}{/if}
                  </span>
                  {#if entry.status === "COMPLETED"}
                    <button
                      type="button"
                      class="link-accent text-xs disabled:opacity-50"
                      disabled={saving}
                      onclick={() => addReplayMut.mutate()}>
                      + J'ai refait ce jeu
                    </button>
                  {/if}
                </div>
                {#if entry.replays.length > 0}
                  <ul class="flex flex-col gap-1">
                    {#each entry.replays as replay (replay.id)}
                      <li class="text-dim flex items-center gap-2 text-xs">
                        <span class="flex-1">
                          {formatDate(replay.finishedAt)}
                        </span>
                        <button
                          type="button"
                          class="hover:text-danger"
                          aria-label="Supprimer cette relecture"
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
          </TrackingPanel>
        {/if}

        <!-- Details panel, mobile position: after "Mon suivi", before the carousels. -->
        {#if hasMeta}
          <div class="mt-8 md:hidden">
            {@render detailsPanel()}
          </div>
        {/if}

        <RelatedCarousel
          title={detail.franchiseName
            ? `Dans la franchise ${detail.franchiseName}`
            : "Même franchise"}
          items={toCarouselItems(detail.franchiseGames, "/app/games")} />

        <RelatedCarousel
          title="Titres similaires"
          items={toCarouselItems(detail.similarGames, "/app/games")} />

        {#if entry}
          <ReviewsSection
            targetType="GAME"
            targetId={entry.game.id}
            workTitle={detail.title} />
          {#if appConfig.socialEnabled}
            <CommentThread targetType="GAME" targetId={entry.game.id} />
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
            {#if detail && detail.developers.length > 0}
              <div>
                <dt class="timecode text-xs">Développeur</dt>
                <dd class="mt-0.5 text-sm">
                  {detail.developers.join(", ")}
                </dd>
              </div>
            {/if}
            {#if detail && detail.publishers.length > 0}
              <div>
                <dt class="timecode text-xs">Éditeur</dt>
                <dd class="mt-0.5 text-sm">
                  {detail.publishers.join(", ")}
                </dd>
              </div>
            {/if}
            {#if detail && detail.gameModes.length > 0}
              <div>
                <dt class="timecode text-xs">Modes de jeu</dt>
                <dd class="mt-0.5 text-sm">{detail.gameModes.join(", ")}</dd>
              </div>
            {/if}
            {#if detail && detail.playerPerspectives.length > 0}
              <div>
                <dt class="timecode text-xs">Vue</dt>
                <dd class="mt-0.5 text-sm">
                  {detail.playerPerspectives.join(", ")}
                </dd>
              </div>
            {/if}
            {#if detail && detail.multiplayerModes.length > 0}
              <div>
                <dt class="timecode text-xs">Multijoueur</dt>
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
                class="btn-text btn-text-underline text-accent hover:text-accent mt-0.5">
                Site officiel ↗
              </a>
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
      title="Retirer de ma bibliothèque"
      message={`Retirer « ${detail.title} » de ta bibliothèque ? Ta progression, ta critique, tes commentaires et ta note seront supprimés.`}
      confirmLabel={m.common_remove()}
      danger
      busy={removeMut.loading}
      onConfirm={() => removeMut.mutate()}
      onCancel={() => (confirmRemove = false)} />
  {/if}

  {#if lightboxOpen}
    <Lightbox
      images={galleryImages}
      video={detail.trailerVideoId
        ? { videoId: detail.trailerVideoId, alt: "Bande-annonce" }
        : null}
      bind:index={lightboxIndex}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <DetailHeroSkeleton />
{/if}
