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
  import { toCarouselItems } from "$lib/carousel";
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
  import AddToListButton from "$lib/components/AddToListButton.svelte";
  import ReviewsSection from "$lib/components/ReviewsSection.svelte";
  import SegmentedStatusControl from "$lib/components/SegmentedStatusControl.svelte";
  import TrackingPanel from "$lib/components/TrackingPanel.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { formatDate } from "$lib/format";
  import { createLibraryEntryActions } from "$lib/library-entry";
  import {
    GAME_OWNERSHIP_SOURCES,
    GAME_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/ownership-sources";
  import {
    GAME_STATUS_SEG_ACTIVE as SEG_ACTIVE,
    GAME_STATUS_DESC as STATUS_DESC,
    GAME_STATUS_META as STATUS_META,
    GAME_STATUS_ORDER as STATUS_ORDER,
  } from "$lib/status-labels";
  import { m } from "$lib/paraglide/messages.js";
  import type { GameDetailDto } from "@loomkeep/shared";

  // IGDB is the only game source today; the web route carries just the id.
  const SOURCE = "igdb";

  // Brand-ish colors per rating source (no official logos — those are
  // trademarked). Literal classes so Tailwind picks them up.
  const RATING_STYLES: Record<string, string> = {
    IGDB: "bg-[#9147ff] text-white",
    Critiques: "bg-[#66cc33] text-black",
  };

  let detail = $state<GameDetailDto | null>(null);
  let error = $state<string | null>(null);
  let saving = $state(false);
  let confirmRemove = $state(false);
  let removing = $state(false);

  const id = $derived(page.params.id ?? "");
  const entry = $derived(detail?.entry ?? null);
  const hasMeta = $derived(
    !!detail &&
      (detail.developers.length > 0 ||
        detail.publishers.length > 0 ||
        detail.gameModes.length > 0 ||
        detail.playerPerspectives.length > 0),
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

  function openLightbox(url: string | null) {
    if (!url) return;
    const i = galleryImages.findIndex((img) => img.src === url);
    lightboxIndex = i >= 0 ? i : 0;
    lightboxOpen = true;
  }

  $effect(() => {
    const i = id;
    if (!i) return;
    error = null;
    getGameDetail(SOURCE, i)
      .then((result) => (detail = result))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          error =
            "Ce jeu est réservé aux comptes ayant activé le contenu pour adultes (réglages).";
        } else {
          error =
            err instanceof ApiError
              ? err.message
              : m.common_fetch_error_fallback();
        }
      });
  });

  const { add, patch, doRemove, addReplay, removeReplay } =
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
        load: () => getGameDetail(SOURCE, id),
        add: (d) =>
          upsertGameEntry({
            source: d.source,
            sourceId: d.sourceId,
            status: "BACKLOG",
          }),
        update: updateGameEntry,
        remove: deleteGameEntry,
        addReplay: addGameReplay,
        removeReplay: deleteGameReplay,
        addErrorMessage: "Impossible d'ajouter ce jeu",
      },
    );
</script>

{#if error}
  <div class="mx-auto max-w-4xl px-5 py-6 md:px-8">
    <Banner variant="error">{error}</Banner>
    <a href="/app/games" class="btn btn-ghost mt-4">← Jeux</a>
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
    <a
      href="/app/games"
      class="border-border bg-bg/60 hover:bg-bg absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold backdrop-blur">
      ← Jeux
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
                  <span
                    class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold {RATING_STYLES[
                      r.source
                    ] ?? 'bg-surface-2 text-fg'}">
                    <span>{r.source}</span>
                    <span class="tabular-nums opacity-90">{r.score}</span>
                  </span>
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

        {#if detail.website}
          <a
            href={detail.website}
            target="_blank"
            rel="noopener noreferrer"
            class="link-accent mt-4 inline-flex items-center gap-1 text-sm">
            Site officiel ↗
          </a>
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
            <SegmentedStatusControl
              statuses={STATUS_ORDER}
              current={entry.status}
              disabled={saving}
              meta={STATUS_META}
              desc={STATUS_DESC}
              activeClass={SEG_ACTIVE}
              onSelect={(status) => patch({ status })} />

            <AddToListButton targetType="GAME" targetId={entry.game.id} />

            <hr class="border-border" />

            <NoteField
              value={entry.notes}
              placeholder="Un boss, une astuce, ta config…"
              onChange={(v) => patch({ notes: v })} />

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
                      patch({ playtimeMinutes: Math.round(hours * 60) });
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
                patch({
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
                      onclick={addReplay}>
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
                          onclick={() => removeReplay(replay.id)}>
                          Supprimer
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
          title="Même franchise"
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
          <h2 class="font-display text-sm font-bold tracking-tight">Détails</h2>
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
  <DetailHeroSkeleton />
{/if}
