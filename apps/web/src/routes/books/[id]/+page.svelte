<script lang="ts">
  import { page } from "$app/state";
  import {
    addBookReplay,
    ApiError,
    deleteBookEntry,
    deleteBookReplay,
    getBookDetail,
    updateBookEntry,
    upsertBookEntry,
  } from "$lib/api/client";
  import { toCarouselItems } from "$lib/carousel";
  import Banner from "$lib/components/Banner.svelte";
  import AddToListButton from "$lib/components/AddToListButton.svelte";
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
  import { formatDate } from "$lib/format";
  import { createLibraryEntryActions } from "$lib/library-entry";
  import {
    BOOK_OWNERSHIP_SOURCES,
    BOOK_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/ownership-sources";
  import {
    BOOK_STATUS_SEG_ACTIVE as SEG_ACTIVE,
    BOOK_STATUS_DESC as STATUS_DESC,
    BOOK_STATUS_META as STATUS_META,
    BOOK_STATUS_ORDER as STATUS_ORDER,
  } from "$lib/status-labels";
  import type { BookDetailDto } from "@loomkeep/shared";

  // Google Books is the only book source today; the web route carries just the id.
  const SOURCE = "google_books";

  // Brand-ish color for the rating source (no official logo — trademarked).
  const RATING_STYLES: Record<string, string> = {
    "Google Books": "bg-[#4285f4] text-white",
  };

  let detail = $state<BookDetailDto | null>(null);
  let error = $state<string | null>(null);
  let saving = $state(false);
  let confirmRemove = $state(false);
  let removing = $state(false);
  let lightboxOpen = $state(false);

  const id = $derived(page.params.id ?? "");
  const entry = $derived(detail?.entry ?? null);
  const hasMeta = $derived(
    !!detail && (!!detail.publisher || !!detail.pageCount),
  );

  // Reading progress as a percentage of the known page count (0 when unknown).
  const progressPct = $derived(
    entry && detail?.pageCount
      ? Math.min(100, Math.round((entry.currentPage / detail.pageCount) * 100))
      : 0,
  );

  $effect(() => {
    const i = id;
    if (!i) return;
    error = null;
    getBookDetail(SOURCE, i)
      .then((result) => (detail = result))
      .catch((err) => {
        error = err instanceof ApiError ? err.message : "Chargement impossible";
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
        load: () => getBookDetail(SOURCE, id),
        add: (d) =>
          upsertBookEntry({
            source: d.source,
            sourceId: d.sourceId,
            status: "TO_READ",
          }),
        update: updateBookEntry,
        remove: deleteBookEntry,
        addReplay: addBookReplay,
        removeReplay: deleteBookReplay,
        addErrorMessage: "Impossible d'ajouter ce livre",
      },
    );
</script>

{#if error}
  <div class="mx-auto max-w-4xl px-5 py-6 md:px-8">
    <Banner variant="error">{error}</Banner>
    <a href="/books" class="btn btn-ghost mt-4">← Livres</a>
  </div>
{/if}

{#if detail}
  <!-- Hero: books have no wide artwork, so a gradient fades into the page. -->
  <div class="relative">
    <div class="from-surface-2 to-surface h-44 w-full bg-linear-to-br md:h-60">
    </div>
    <div
      class="from-bg via-bg/50 absolute inset-0 bg-linear-to-t to-transparent">
    </div>
    <a
      href="/books"
      class="border-border bg-bg/60 hover:bg-bg absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold backdrop-blur">
      ← Livres
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
            onclick={() => detail?.coverUrl && (lightboxOpen = true)}>
            <Poster src={detail.coverUrl} title={detail.title} />
          </button>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="bg-surface-2 text-dim rounded-full px-2.5 py-0.5 text-xs font-semibold">
                Livre
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
            {#if detail.subtitle}
              <p class="text-dim mt-0.5 text-lg">{detail.subtitle}</p>
            {/if}
            {#if detail.authors.length > 0}
              <p class="font-display text-dim mt-1.5 text-lg font-semibold">
                {detail.authors.join(", ")}
              </p>
            {/if}
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
            Voir sur Google Books ↗
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

            <AddToListButton targetType="BOOK" targetId={entry.book.id} />

            <!-- Reading progress: page position, with a bar when the total is known. -->
            <div class="flex flex-col gap-2">
              <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase"
                >Progression de lecture</span>
              <div class="text-dim flex items-center gap-2 text-sm">
                <span>Page</span>
                <input
                  type="number"
                  min="0"
                  max={detail.pageCount ?? undefined}
                  class="input w-24"
                  value={entry.currentPage || ""}
                  onchange={(e) => {
                    const raw = e.currentTarget.value;
                    void patch({ currentPage: raw === "" ? 0 : Number(raw) });
                  }} />
                {#if detail.pageCount}
                  <span class="timecode">/ {detail.pageCount}</span>
                  <span class="font-display text-fg ml-auto font-bold">
                    {progressPct} %
                  </span>
                {/if}
              </div>
              {#if detail.pageCount}
                <div class="bg-surface-2 h-2 overflow-hidden rounded-full">
                  <div
                    class="bg-accent h-full rounded-full transition-[width]"
                    style={`width:${progressPct}%`}>
                  </div>
                </div>
              {/if}
            </div>

            <hr class="border-border" />

            <NoteField
              value={entry.notes}
              placeholder="Une phrase, une note de lecture…"
              onChange={(v) => patch({ notes: v })} />

            <hr class="border-border" />

            <OwnershipField
              status={entry.ownershipStatus}
              source={entry.ownershipSource}
              statusOptions={BOOK_OWNERSHIP_STATUS_OPTIONS}
              sourceOptionsByStatus={BOOK_OWNERSHIP_SOURCES}
              onChange={(status, source) =>
                patch({
                  ownershipStatus: status as typeof entry.ownershipStatus,
                  ownershipSource: source,
                })} />

            {#if entry.status === "READ" || entry.replays.length > 0}
              <hr class="border-border" />

              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
                    Relectures{#if entry.replays.length > 0}
                      &nbsp;· {entry.replays.length}{/if}
                  </span>
                  {#if entry.status === "READ"}
                    <button
                      type="button"
                      class="link-accent text-xs disabled:opacity-50"
                      disabled={saving}
                      onclick={addReplay}>
                      + J'ai relu ce livre
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

        <RelatedCarousel
          title="Du même auteur"
          items={toCarouselItems(detail.sameAuthorBooks, "/books")} />

        <!-- Details panel, mobile position: after "Mon suivi". -->
        {#if hasMeta}
          <div class="mt-8 md:hidden">
            {@render detailsPanel()}
          </div>
        {/if}

        {#if entry}
          <ReviewsSection
            targetType="BOOK"
            targetId={entry.book.id}
            workTitle={detail.title} />
          {#if appConfig.socialEnabled}
            <CommentThread targetType="BOOK" targetId={entry.book.id} />
          {/if}
        {/if}
      </div>

      <!-- Details panel, desktop position: sidebar next to the main column. -->
      {#snippet detailsPanel()}
        <div class="card p-4">
          <h2 class="font-display text-sm font-bold tracking-tight">Détails</h2>
          <dl class="mt-3 flex flex-col gap-3">
            {#if detail?.publisher}
              <div>
                <dt class="timecode text-xs">Éditeur</dt>
                <dd class="mt-0.5 text-sm">{detail.publisher}</dd>
              </div>
            {/if}
            {#if detail?.pageCount}
              <div>
                <dt class="timecode text-xs">Pages</dt>
                <dd class="mt-0.5 text-sm">{detail.pageCount}</dd>
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

  {#if lightboxOpen && detail.coverUrl}
    <Lightbox
      images={[{ src: detail.coverUrl, alt: detail.title }]}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <DetailHeroSkeleton />
{/if}
