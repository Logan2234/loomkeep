<script lang="ts">
  import ClampedText from "#lib/components/ClampedText.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import StatusCorrectionModal from "#lib/components/StatusCorrectionModal.svelte";
  import ExternalRatingChips from "#lib/components/ExternalRatingChips.svelte";
  import DetailsCard from "#lib/components/DetailsCard.svelte";
  import WorkSocialSection from "#lib/components/WorkSocialSection.svelte";
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
  import { goBack } from "#lib/back-nav.svelte.js";
  import { toCarouselItems } from "#lib/carousel.js";
  import Banner from "#lib/components/Banner.svelte";
  import BookSessionDock from "#lib/components/BookSessionDock.svelte";
  import Combobox from "#lib/components/Combobox.svelte";
  import WorkFriendsStrip from "#lib/components/WorkFriendsStrip.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import ConfirmationModal from "#lib/components/ConfirmationModal.svelte";
  import DetailHeroSkeleton from "#lib/components/DetailHeroSkeleton.svelte";
  import Lightbox from "#lib/components/Lightbox.svelte";

  import MyRatingBadge from "#lib/components/MyRatingBadge.svelte";
  import NoteField from "#lib/components/NoteField.svelte";
  import OwnershipField from "#lib/components/OwnershipField.svelte";

  import RelatedCarousel from "#lib/components/RelatedCarousel.svelte";

  import CommentsPanel from "#lib/components/CommentsPanel.svelte";
  import WorkActionBar from "#lib/components/work/WorkActionBar.svelte";
  import WorkHero from "#lib/components/work/WorkHero.svelte";
  import WorkTrackingFold from "#lib/components/work/WorkTrackingFold.svelte";
  import ShareWorkModal from "#lib/components/ShareWorkModal.svelte";
  import { bookWork } from "#lib/chat/work-search.js";
  import TrackingStatusBadge from "#lib/components/TrackingStatusBadge.svelte";

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
  import { joinMeta, compareText } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    BOOK_DIRECT_STATUS_TARGETS,
    statusCorrectionLabel,
    cycleAwareStatusCorrections,
  } from "#lib/status-corrections.js";

  // Open Library is the only book source today; the web route carries just
  // the work id (e.g. "OL893414W").
  const SOURCE = "open_library";

  let confirmRemove = $state(false);
  let compact = $state(false);
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
  const work = $derived(detail ? bookWork(detail) : null);
  let sharing = $state(false);
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
      .sort((a, b) => compareText(a.label, b.label)),
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

  const saving = $derived(addMut.loading || patchMut.loading);
  const statusCorrections = $derived(
    entry
      ? cycleAwareStatusCorrections(
          STATUS_ORDER,
          entry.status,
          BOOK_DIRECT_STATUS_TARGETS[entry.status],
          "TO_READ",
          entry.readings,
        )
      : [],
  );

  const correctionLabel = $derived(
    statusCorrectionLabel(statusCorrections, m.book_status_reset_to_read()),
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
  <WorkHero
    title={detail.title}
    backdropUrl={null}
    coverUrl={detail.coverUrl || null}
    backHref="/app/books"
    backLabel={m.common_Books()}
    onEnlargeCover={() => detail?.coverUrl && (lightboxOpen = true)}
    onCompactChange={(value) => (compact = value)}>
    {#snippet pills()}
      <span
        class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
        {m.common_Book()}
      </span>
      {#if entry}
        <TrackingStatusBadge domain="BOOKS" status={entry.status} onImage />
      {/if}
      {#if detail.isAdult}
        <span
          class="bg-danger/80 rounded-full px-2.5 py-0.5 text-xs font-bold text-white">
          18+
        </span>
      {/if}
    {/snippet}
    {#if detail.subtitle}
      <p class="mt-0.5 text-white/80">{detail.subtitle}</p>
    {/if}
    {#if detail.authors.length > 0}
      <p class="font-display mt-1.5 font-semibold text-white/90">
        {detail.authors.join(", ")}
      </p>
    {/if}
    <p class="timecode mt-1.5 text-sm text-white/80">
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
            workImageUrl={detail.coverUrl}
            overlay />
        {/if}
        <ExternalRatingChips ratings={detail.ratings} providerMarks overlay />
      </div>
    {/if}
  </WorkHero>

  <WorkActionBar
    tracked={!!entry}
    status={entry ? STATUS_META[entry.status].label : undefined}
    statusTone={entry?.status === "DROPPED"
      ? "danger"
      : entry?.status === "READ"
        ? "success"
        : "accent"}
    {compact}
    title={detail.title}
    {saving}
    favorite={entry?.favorite}
    listTarget={entry ? { type: "BOOK", id: entry.book.id } : undefined}
    actions={!entry
      ? []
      : [
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
          targetType="BOOK"
          targetId={detail.commentTargetId}
          title={detail.title}
          canParticipate={!!entry}
          revealSpoilersByDefault={entry?.status === "READ"}
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
          domain="BOOKS"
          targetType="BOOK"
          targetId={detail.commentTargetId}
          revision={`${entry?.status}:${entry?.currentPage}`} />
      {/if}

      {#if entry}
        <div class="mt-6 max-w-xl">
          <BookSessionDock {entry} {detailKey} />
        </div>
      {/if}

      {#if detail.firstSentence}
        <p
          class="text-dim border-border mt-6 max-w-2xl border-l-2 pl-3 text-sm italic">
          « {detail.firstSentence} »
        </p>
      {/if}

      {#if detail.overview}
        <div class="mt-6 max-w-2xl">
          <ClampedText
            text={detail.overview}
            lines={layout.compact ? 3 : 8}
            class="text-dim whitespace-pre-line" />
        </div>
      {/if}

      {#if entry}
        <WorkTrackingFold summary={m.media_tracking_summary()}>
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
          <NoteField
            value={entry.notes}
            placeholder={m.book_note_placeholder()}
            onChange={(v) => patchMut.mutate({ notes: v })} />
        </WorkTrackingFold>
      {/if}

      {#if hasMeta}
        <div class="mt-8 md:hidden">
          {@render detailsPanel()}
        </div>
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

      <WorkSocialSection
        targetType="BOOK"
        reviewTargetId={entry?.book.id ?? null}
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
          </dt>
          <dd class="mt-1.5">
            <Combobox
              label={m.common_language()}
              options={editionOptions}
              values={[selectedEdition ?? ""]}
              searchable={editionOptions.length > 6}
              disabled={bookQuery.loading}
              onChange={([value]) => (selectedEdition = value || undefined)} />
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

      {#snippet footer()}{#if detail.website || detail.readOnlineUrl || detail.externalLinks.length > 0}
          <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
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
        {/if}{/snippet}
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

  {#if lightboxOpen && detail.coverUrl}
    <Lightbox
      images={[{ src: detail.coverUrl, alt: detail.title }]}
      onClose={() => (lightboxOpen = false)} />
  {/if}
{:else if !error}
  <DetailHeroSkeleton />
{/if}
