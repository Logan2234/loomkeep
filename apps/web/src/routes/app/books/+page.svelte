<script lang="ts">
  import { updateBookEntry } from "$lib/api/books";
  import { listBooks } from "$lib/api/client";
  import type { LibraryLoadParams } from "$lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ReadingGoalChip from "$lib/components/ReadingGoalChip.svelte";
  import BookSearchPanel from "$lib/components/search/BookSearchPanel.svelte";
  import {
    BOOK_STATUS_LABELS,
    BOOK_STATUS_ORDER,
  } from "$lib/constants/status-labels";
  import { toggleFavorite } from "$lib/favorite-toggle";
  import { m } from "$lib/paraglide/messages";
  import { Domain, type BookEntryDto } from "@loomkeep/shared";

  const STATUS_OPTIONS = BOOK_STATUS_ORDER.map((value) => ({
    label: BOOK_STATUS_LABELS[value],
    value,
  }));

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

  const load = (params: LibraryLoadParams) =>
    listBooks({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      sort: params.sort,
      order: params.order,
      page: params.page,
    });
</script>

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
  keyOf={(e) => e.id}
  statusOptions={STATUS_OPTIONS}
  sorts={SORTS}
  defaultSort="added">
  {#snippet headerActions()}
    <ReadingGoalChip showBadge />
  {/snippet}
  {#snippet catalogPreview(query: string, onResults: (n: number) => void)}
    <BookSearchPanel {query} limit={10} {onResults} />
  {/snippet}
  {#snippet card(entry: BookEntryDto)}
    <PosterCard
      href={`/app/books/${entry.book.sourceId}`}
      src={entry.book.coverUrl}
      title={entry.book.title}
      favorite={entry.favorite}
      onToggleFavorite={(next) =>
        toggleFavorite(entry, next, (n) =>
          updateBookEntry(entry.id, { favorite: n }),
        )}>
      {#snippet meta()}
        {#if entry.book.pageCount}
          <ProgressBar value={pct(entry)} />
          <span class="timecode text-xs">
            {entry.currentPage} / {entry.book.pageCount}
            {m.book_pages_lower()}
          </span>
        {:else}
          <span class="timecode text-xs">
            {BOOK_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
              · ★ {entry.rating}{/if}
          </span>
        {/if}
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
