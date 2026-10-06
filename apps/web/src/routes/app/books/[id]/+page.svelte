<script lang="ts">
  import { page } from "$app/state";
  import {
    deleteBookEntry,
    getBookDetail,
    getBookEditions,
    getBookSaga,
    updateBookEntry,
    upsertBookEntry,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import BookSagaSection from "./components/BookSagaSection.svelte";
  import { goBack } from "#lib/backNav.svelte.js";
  import { toCarouselItems } from "#lib/carousel.js";
  import Banner from "#lib/components/Banner.svelte";
  import BookSessionDock from "#lib/components/BookSessionDock.svelte";
  import Combobox from "#lib/components/Combobox.svelte";
  import CommentsPanel from "#lib/components/CommentsPanel.svelte";
  import ConfirmationModal from "#lib/components/ConfirmationModal.svelte";
  import DetailHeroSkeleton from "#lib/components/DetailHeroSkeleton.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Lightbox from "#lib/components/Lightbox.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import MyRatingBadge from "#lib/components/MyRatingBadge.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import NoteField from "#lib/components/NoteField.svelte";
  import OwnershipField from "#lib/components/OwnershipField.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import ProviderMark from "#lib/components/ProviderMark.svelte";
  import RelatedCarousel from "#lib/components/RelatedCarousel.svelte";
  import ReviewsSection from "#lib/components/ReviewsSection.svelte";
  import SegmentedStatusControl from "#lib/components/SegmentedStatusControl.svelte";
  import TrackingPanel from "#lib/components/TrackingPanel.svelte";
  import RecommendButton from "#lib/components/chat/RecommendButton.svelte";
  import { bookWork } from "#lib/chat/work-search.js";
  import TrackingStatusBadge from "#lib/components/TrackingStatusBadge.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import {
    BOOK_OWNERSHIP_SOURCES,
    BOOK_OWNERSHIP_STATUS_OPTIONS,
  } from "#lib/constants/ownership-sources.js";
  import {
    BOOK_STATUS_SEG_ACTIVE as SEG_ACTIVE,
    BOOK_STATUS_DESC as STATUS_DESC,
    BOOK_STATUS_META as STATUS_META,
    BOOK_STATUS_ORDER as STATUS_ORDER,
  } from "#lib/constants/status-labels.js";
  import { createEntryTrackingMutations } from "#lib/entry-tracking-mutations.svelte.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { joinMeta } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    BOOK_DIRECT_STATUS_TARGETS,
    getStatusCorrections,
  } from "#lib/status-corrections.js";

  // Open Library is the only book source today; the web route carries just
  // the work id (e.g. "OL893414W").
  const SOURCE = "open_library";

  const RATING_STYLES: Record<string, string> = {
    "Open Library": "bg-[#e1dcc5] text-black",
  };
  const RATING_BRANDS = {
    "Open Library": "openlibrary",
  } as const;

  let confirmRemove = $state(false);
  let statusEditorOpen = $state(false);
  let lightboxOpen = $state(false);
  // Manually picked edition (an OLID from `editionsQuery`); undefined = the
  // interface-language auto-pick. Local to this page view — not persisted.
  let selectedEdition = $state<string | undefined>(undefined);

  const id = $derived(page.params.id ?? "");
  const detailKey = $derived(keys.books.detail(SOURCE, id, selectedEdition));

  const bookQuery = createApiQuery(() => ({
    key: detailKey,
    fetch: () => getBookDetail(SOURCE, id, selectedEdition),
    enabled: !!id,
  }));
  const detail = $derived(bookQuery.data);
  // 18+ titles never become a card: the friend may not allow them.
  const work = $derived(detail && !detail.isAdult ? bookWork(detail) : null);
  const error = $derived(bookQuery.error);

  // The interface-language auto-pick's own language, captured once and kept
  // stable across manual selections — `detail.language` changes to whatever
  // edition is currently shown, so it can't be read directly for the
  // "Automatique (…)" label without it drifting to match the selection.
  let autoLanguage = $state<string | null>(null);
  $effect(() => {
    if (!selectedEdition && detail?.language) autoLanguage = detail.language;
  });

  const editionsQuery = createApiQuery(() => ({
    key: keys.books.editions(SOURCE, id),
    fetch: () => getBookEditions(SOURCE, id),
    enabled: !!id,
  }));
  // Only worth showing a selector once there's an actual choice to make.
  const editions = $derived(
    (editionsQuery.data ?? []).length > 1 ? editionsQuery.data! : [],
  );

  // "" stands for the interface-language auto-pick. A work can have editions
  // in a dozen+ languages (e.g. Harry Potter) — a searchable dropdown scales
  // to that; a segmented control doesn't.
  const editionOptions = $derived([
    {
      value: "",
      label: autoLanguage
        ? `${m.book_edition_auto()} (${autoLanguage})`
        : m.book_edition_auto(),
    },
    ...editions
      .map((e) => ({ value: e.key, label: e.language ?? e.title }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ]);

  const entry = $derived(detail?.entry ?? null);

  // Read here rather than in the saga block: the same-author carousel leaves
  // out the series' volumes, which the block already lists.
  const sagaKey = $derived(
    keys.books.saga(detail?.seriesKey ?? "", entry !== null),
  );
  const sagaQuery = createApiQuery(() => ({
    key: sagaKey,
    fetch: () => getBookSaga(detail!.seriesKey!).then((r) => r.saga),
    enabled: !!detail?.seriesKey,
    keepPreviousData: true,
  }));
  const sagaIds = $derived(
    new Set(sagaQuery.data?.members.map((x) => x.sourceId)),
  );
  const reviewMeta = $derived(
    detail ? joinMeta(detail.authors.join(", "), detail.year) : "",
  );
  const hasMeta = $derived(
    !!detail &&
      (!!detail.publisher ||
        !!detail.pageCount ||
        !!detail.editionCount ||
        !!detail.series ||
        !!detail.language ||
        !!detail.isbn),
  );

  const { addMut, patchMut, removeMut } = createEntryTrackingMutations({
    detailKey: () => detailKey,
    detail: () => detail,
    entryId: () => entry?.id,
    upsert: (d) =>
      upsertBookEntry({
        source: d.source,
        sourceId: d.sourceId,
        status: "TO_READ",
        editionKey: d.editionKey,
        referencePageCount: d.pageCount,
      }),
    update: (id, changes: Parameters<typeof updateBookEntry>[1]) =>
      updateBookEntry(id, changes),
    remove: (id) => deleteBookEntry(id),
    onRemoveSuccess: () => (confirmRemove = false),
  });

  // Every action but "remove" shared one `saving` flag before the move to
  // the centralized API layer — kept combined here rather than split
  // per-button, since that's what the template already disables on.
  const saving = $derived(addMut.loading || patchMut.loading);
  const statusCorrections = $derived(
    entry
      ? getStatusCorrections(
          STATUS_ORDER,
          entry.status,
          BOOK_DIRECT_STATUS_TARGETS[entry.status],
        ).filter(
          (status) =>
            status !== "TO_READ" ||
            !entry.readings.some(
              (reading) =>
                reading.status === "ACTIVE" && reading.sessionCount > 0,
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

  let restoredEdition = $state(false);
  let editionSyncTarget = $state<string | null>(null);
  $effect(() => {
    if (!restoredEdition && entry) {
      restoredEdition = true;
      if (entry.editionKey) selectedEdition = entry.editionKey;
    }
  });
  $effect(() => {
    const editionKey = detail?.editionKey ?? null;
    const pageCount = detail?.pageCount ?? null;
    if (!restoredEdition || !entry || !editionKey || !pageCount) return;
    if (selectedEdition && editionKey !== selectedEdition) return;
    if (
      entry.editionKey === editionKey &&
      entry.referencePageCount === pageCount
    ) {
      editionSyncTarget = null;
      return;
    }
    if (editionSyncTarget === editionKey || patchMut.loading) return;
    editionSyncTarget = editionKey;
    patchMut.mutate({ editionKey, referencePageCount: pageCount });
  });
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
    <a href="/app/books" onclick={goBack} class="btn btn-ghost mt-4"
      >← {m.common_Books()}</a>
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
      href="/app/books"
      onclick={goBack}
      class="border-border bg-bg/60 hover:bg-bg absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold backdrop-blur">
      ← {m.common_Books()}
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
            onclick={() => detail?.coverUrl && (lightboxOpen = true)}>
            <Poster src={detail.coverUrl} title={detail.title} alt="" />
          </button>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="bg-surface-2 text-dim rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {m.common_Book()}
              </span>
              {#if detail.isAdult}
                <span
                  class="bg-danger/15 text-danger rounded-full px-2.5 py-0.5 text-xs font-bold">
                  18+
                </span>
              {/if}
              {#if entry}
                <TrackingStatusBadge domain="BOOKS" status={entry.status} />
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
            {#if entry || detail.ratings.length > 0}
              <div class="mt-2.5 flex flex-wrap gap-1.5">
                {#if entry}
                  <MyRatingBadge
                    targetType="BOOK"
                    targetId={entry.book.id}
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
                    {#if RATING_BRANDS[r.source as keyof typeof RATING_BRANDS]}
                      <ProviderMark
                        brand={RATING_BRANDS[
                          r.source as keyof typeof RATING_BRANDS
                        ]}
                        decorative
                        class="h-3.5 w-3.5 shrink-0" />
                    {/if}
                    <span>{r.source}</span>
                    <span class="tabular-nums opacity-90">{r.score}</span>
                  </svelte:element>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        {#if detail.firstSentence}
          <p
            class="text-dim border-border mt-4 max-w-2xl border-l-2 pl-3 text-sm italic">
            « {detail.firstSentence} »
          </p>
        {/if}

        {#if detail.overview}
          <p class="text-dim mt-6 max-w-2xl whitespace-pre-line">
            {detail.overview}
          </p>
        {/if}

        {#snippet recommendButton()}
          {#if work}
            <RecommendButton {work} />
          {/if}
        {/snippet}

        {#if !entry}
          <div class="mt-6 flex items-center gap-2.5">
            <button
              class="btn btn-primary"
              disabled={saving}
              onclick={() => addMut.mutate()}>
              <Icon name="plus" class="h-4 w-4" />
              {m.library_add()}
            </button>
            {#if work}
              <RecommendButton {work} />
            {/if}
          </div>
        {:else}
          <TrackingPanel
            extra={work ? recommendButton : undefined}
            favorite={entry.favorite}
            {saving}
            onToggleFavorite={() =>
              patchMut.mutate({ favorite: !entry.favorite })}
            onRemove={() => (confirmRemove = true)}
            actions={[
              ...(entry.status === "READING"
                ? [
                    {
                      label: m.book_status_mark_read(),
                      icon: "check" as const,
                      onSelect: () => patchMut.mutate({ status: "READ" }),
                    },
                    {
                      label: m.book_status_drop(),
                      icon: "archive" as const,
                      onSelect: () => patchMut.mutate({ status: "DROPPED" }),
                    },
                  ]
                : []),
              ...(entry.status === "DROPPED"
                ? [
                    {
                      label: m.book_status_resume(),
                      icon: "refresh" as const,
                      onSelect: () => patchMut.mutate({ status: "READING" }),
                    },
                  ]
                : []),
              {
                label:
                  statusCorrections.length === 1
                    ? m.book_status_reset_to_read()
                    : m.tracking_correct_status(),
                icon: "edit" as const,
                separator: true,
                onSelect: openStatusCorrection,
              },
            ]}
            targetType="BOOK"
            targetId={entry.book.id}>
            <BookSessionDock {entry} {detailKey} />

            <hr class="border-border" />

            <OwnershipField
              status={entry.ownershipStatus}
              source={entry.ownershipSource}
              statusOptions={BOOK_OWNERSHIP_STATUS_OPTIONS}
              sourceOptionsByStatus={BOOK_OWNERSHIP_SOURCES}
              onChange={(status, source) =>
                patchMut.mutate({
                  ownershipStatus: status as typeof entry.ownershipStatus,
                  ownershipSource: source,
                })} />

            <hr class="border-border" />

            <NoteField
              value={entry.notes}
              placeholder={m.book_note_placeholder()}
              onChange={(v) => patchMut.mutate({ notes: v })} />
          </TrackingPanel>
        {/if}

        {#if sagaQuery.data}
          <BookSagaSection
            saga={sagaQuery.data}
            {sagaKey}
            sourceId={detail.sourceId}
            entryStatus={entry?.status ?? null} />
        {/if}

        <RelatedCarousel
          title={m.book_same_author()}
          items={toCarouselItems(
            detail.sameAuthorBooks.filter((b) => !sagaIds.has(b.sourceId)),
            "/app/books",
          )} />

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
            workTitle={detail.title}
            workMeta={reviewMeta}
            workImageUrl={detail.coverUrl}>
            {#snippet actions()}
              {#if appConfig.socialEnabled && detail.commentTargetId}
                <CommentsPanel
                  targetType="BOOK"
                  targetId={detail.commentTargetId}
                  title={detail.title}
                  canParticipate={!!entry} />
              {/if}
            {/snippet}
          </ReviewsSection>
        {/if}
        {#if appConfig.socialEnabled && detail.commentTargetId && !entry}
          <CommentsPanel
            targetType="BOOK"
            targetId={detail.commentTargetId}
            title={detail.title}
            canParticipate={!!entry} />
        {/if}
      </div>

      <!-- Details panel, desktop position: sidebar next to the main column. -->
      {#snippet detailsPanel()}
        <div class="card p-4">
          <h2 class="font-display text-sm font-bold tracking-tight">
            {m.common_details()}
          </h2>
          <dl class="mt-3 flex flex-col gap-3">
            {#if detail?.publisher}
              <div>
                <dt class="timecode text-xs">{m.media_publisher()}</dt>
                <dd class="mt-0.5 text-sm">{detail.publisher}</dd>
              </div>
            {/if}
            {#if detail?.pageCount}
              <div>
                <dt class="timecode text-xs">{m.book_pages()}</dt>
                <dd class="mt-0.5 text-sm">{detail.pageCount}</dd>
              </div>
            {/if}
            {#if detail?.series}
              <div>
                <dt class="timecode text-xs">{m.book_collection()}</dt>
                <dd class="mt-0.5 text-sm">{detail.series}</dd>
              </div>
            {/if}
            {#if editions.length > 0}
              <div>
                <dt class="timecode flex items-center gap-1.5 text-xs">
                  {m.common_language()}
                  {#if isFeatureNew("book-edition-selector")}<NewBadge />{/if}
                </dt>
                <dd class="mt-1.5">
                  <Combobox
                    label={m.common_language()}
                    options={editionOptions}
                    values={[selectedEdition ?? ""]}
                    searchable={editionOptions.length > 6}
                    disabled={bookQuery.loading}
                    onChange={([value]) =>
                      (selectedEdition = value || undefined)} />
                </dd>
              </div>
            {:else if detail?.language}
              <div>
                <dt class="timecode text-xs">{m.common_language()}</dt>
                <dd class="mt-0.5 text-sm">{detail.language}</dd>
              </div>
            {/if}
            {#if detail?.isbn}
              <div>
                <dt class="timecode text-xs">{m.book_isbn()}</dt>
                <dd class="mt-0.5 text-sm">{detail.isbn}</dd>
              </div>
            {/if}
            {#if detail?.editionCount}
              <div>
                <dt class="timecode text-xs">{m.book_editions()}</dt>
                <dd class="mt-0.5 text-sm">{detail.editionCount}</dd>
              </div>
            {/if}
          </dl>

          {#if detail.website || detail.readOnlineUrl || detail.externalLinks.length > 0}
            <div
              class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              {#if detail.website}
                <a
                  href={detail.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link-accent inline-flex items-center decoration-1">
                  {m.book_open_library_link()}
                </a>
              {/if}
              {#if detail.readOnlineUrl}
                <a
                  href={detail.readOnlineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link-accent inline-flex items-center decoration-1">
                  {m.book_read_online()}
                </a>
              {/if}
              {#each detail.externalLinks as link (link.label)}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link-accent inline-flex items-center gap-1 decoration-1">
                  {link.label} ↗
                </a>
              {/each}
            </div>
          {/if}
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

  {#if lightboxOpen && detail.coverUrl}
    <Lightbox
      images={[{ src: detail.coverUrl, alt: detail.title }]}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <DetailHeroSkeleton />
{/if}
