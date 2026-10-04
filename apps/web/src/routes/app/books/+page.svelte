<script lang="ts">
  import { page } from "$app/state";
  import {
    bulkDeleteBookEntries,
    bulkUpdateBookEntries,
    updateBookEntry,
  } from "$lib/api/books";
  import { getBooksPile, listBooks } from "$lib/api/client";
  import type {
    LibraryLoadParams,
    PileLoadParams,
  } from "$lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ReadingGoalChip from "$lib/components/ReadingGoalChip.svelte";
  import SagasModeSwitch, {
    sagasMode,
  } from "$lib/components/saga/SagasModeSwitch.svelte";
  import BookSearchPanel from "$lib/components/search/BookSearchPanel.svelte";
  import BookSagasView from "./components/BookSagasView.svelte";
  import {
    BOOK_OWNERSHIP_SOURCES,
    BOOK_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/constants/ownership-sources";
  import {
    BOOK_STATUS_LABELS,
    BOOK_STATUS_META,
    BOOK_STATUS_ORDER,
  } from "$lib/constants/status-labels";
  import { DATE_MEDIUM_OPTIONS, formatDate } from "$lib/format";
  import {
    ownershipText,
    type LibraryBulkActions,
    type LibraryColumn,
    type LibraryItemView,
  } from "$lib/library-view";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages";
  import { Domain, isSessionPaused, type BookEntryDto } from "@loomkeep/shared";

  const STATUS_OPTIONS = [
    ...BOOK_STATUS_ORDER.map((value) => ({
      label: BOOK_STATUS_LABELS[value],
      value,
    })),
    { label: m.media_status_paused(), value: "PAUSED" },
  ];

  function pct(entry: BookEntryDto): number {
    if (!entry.book.pageCount) return 0;
    if (entry.status === "READ") return 100;
    return Math.min(
      100,
      Math.round((entry.currentPage / entry.book.pageCount) * 100),
    );
  }

  const SORTS = [
    { label: m.library_sort_added(), value: "added" },
    { label: m.common_title(), value: "title" },
    { label: m.book_author(), value: "author" },
    { label: m.library_rating(), value: "rating" },
    { label: m.book_page_count(), value: "pages" },
    { label: m.book_reading_progress(), value: "progress" },
    { label: m.library_sort_finished(), value: "finished" },
    { label: m.library_sort_started(), value: "started" },
    { label: m.common_status(), value: "status" },
  ];

  const setFavorite = (entry: BookEntryDto, next: boolean) =>
    updateBookEntry(entry.id, { favorite: next });

  const itemView = (entry: BookEntryDto): LibraryItemView => ({
    href: `/app/books/${entry.book.sourceId}`,
    title: entry.book.title,
    subtitle: entry.book.authors.join(", ") || null,
    imageUrl: entry.book.coverUrl,
    status: { value: entry.status, ...BOOK_STATUS_META[entry.status] },
    ownership: entry.ownershipStatus,
    ownershipSource: entry.ownershipSource,
    reviewTarget: { type: "BOOK", id: entry.book.id },
    rating: entry.rating,
    favorite: entry.favorite,
    progress: entry.book.pageCount
      ? {
          percent: pct(entry),
          label: `${entry.currentPage} / ${entry.book.pageCount} ${m.book_pages_lower()}`,
          paused: false,
        }
      : null,
  });

  const COLUMNS: LibraryColumn<BookEntryDto>[] = [
    { key: "title", kind: "title", label: m.common_title(), sort: "title" },
    { key: "status", kind: "status", label: m.common_status(), sort: "status" },
    {
      key: "progress",
      kind: "progress",
      label: m.common_progress(),
      sort: "progress",
    },
    {
      key: "rating",
      kind: "rating",
      label: m.library_rating(),
      sort: "rating",
      numeric: true,
    },
    {
      key: "ownership",
      kind: "text",
      ownership: true,
      label: m.ownership_title(),
      value: (e) =>
        ownershipText(
          BOOK_OWNERSHIP_STATUS_OPTIONS,
          e.ownershipStatus,
          e.ownershipSource,
        ),
    },
    {
      key: "finished",
      kind: "text",
      label: m.library_col_finished(),
      sort: "finished",
      value: (e) =>
        e.finishedAt ? formatDate(e.finishedAt, DATE_MEDIUM_OPTIONS) : null,
    },
    {
      key: "added",
      kind: "text",
      label: m.library_col_added(),
      sort: "added",
      value: (e) => formatDate(e.createdAt, DATE_MEDIUM_OPTIONS),
    },
    {
      key: "started",
      kind: "text",
      label: m.library_col_started(),
      sort: "started",
      defaultHidden: true,
      value: (e) =>
        e.startedAt ? formatDate(e.startedAt, DATE_MEDIUM_OPTIONS) : null,
    },
    {
      key: "notes",
      kind: "text",
      label: m.library_col_notes(),
      defaultHidden: true,
      truncate: true,
      value: (e) => e.notes,
    },
  ];

  const BULK: LibraryBulkActions = {
    statusOptions: STATUS_OPTIONS,
    ownershipOptions: BOOK_OWNERSHIP_STATUS_OPTIONS,
    ownershipSources: BOOK_OWNERSHIP_SOURCES,
    update: (dto) =>
      bulkUpdateBookEntries(dto as Parameters<typeof bulkUpdateBookEntries>[0]),
    remove: bulkDeleteBookEntries,
  };

  const load = (params: LibraryLoadParams) =>
    listBooks({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      sort: params.sort,
      order: params.order,
      page: params.page,
    });

  const loadPile = (params: PileLoadParams) =>
    getBooksPile({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
    });

  const mode = $derived(sagasMode(page.url));
</script>

{#snippet modeSwitch()}
  <SagasModeSwitch isNew={isFeatureNew("book-sagas")} />
{/snippet}

{#if mode === "sagas"}
  <BookSagasView {modeSwitch} />
{:else}
  <LibraryBrowser
    icon="book"
    title={m.common_Books()}
    subtitle={(n) =>
      n === 1
        ? m.book_library_count_one({ count: n })
        : m.book_library_count_many({ count: n })}
    noun={m.common_book()}
    domain={Domain.BOOKS}
    {load}
    {loadPile}
    keyOf={(e) => e.id}
    statusOptions={STATUS_OPTIONS}
    sorts={SORTS}
    defaultSort="added"
    {itemView}
    columns={COLUMNS}
    bulk={BULK}
    {setFavorite}>
    {#snippet headerActions()}
      <div class="flex items-center gap-2">
        <ReadingGoalChip />
        {@render modeSwitch()}
      </div>
    {/snippet}
    {#snippet catalogPreview(query: string, onResults: (n: number) => void)}
      <BookSearchPanel {query} limit={10} {onResults} />
    {/snippet}
    {#snippet card(
      entry: BookEntryDto,
      onToggleFavorite: (next: boolean) => void,
    )}
      <PosterCard
        href={`/app/books/${entry.book.sourceId}`}
        src={entry.book.coverUrl}
        title={entry.book.title}
        favorite={entry.favorite}
        {onToggleFavorite}>
        {#snippet meta()}
          {#if entry.book.pageCount}
            <ProgressBar
              value={pct(entry)}
              label={m.common_selection_summary({
                label: m.book_reading_progress(),
                selection: entry.book.title,
              })} />
            <span class="timecode text-xs">
              {entry.currentPage} / {entry.book.pageCount}
              {m.book_pages_lower()}
              {#if isSessionPaused(entry, "READING")}
                {m.media_paused_suffix()}
              {/if}
            </span>
          {:else}
            <span class="timecode text-xs">
              {BOOK_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
                · ★ {entry.rating}{/if}{#if isSessionPaused(entry, "READING")}
                {m.media_paused_suffix()}{/if}
            </span>
          {/if}
        {/snippet}
      </PosterCard>
    {/snippet}
  </LibraryBrowser>
{/if}
