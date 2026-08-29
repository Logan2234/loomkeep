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
  import { m } from "$lib/paraglide/messages";
  import { toast } from "$lib/toast.svelte";
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
    { label: "Ajout récent", value: "added" },
    { label: m.common_title(), value: "title" },
    { label: "Auteur", value: "author" },
    { label: "Note", value: "rating" },
    { label: "Nombre de pages", value: "pages" },
    { label: "Progression de lecture", value: "progress" },
    { label: "Terminé récemment", value: "finished" },
    { label: "Commencé récemment", value: "started" },
    { label: m.common_status(), value: "status" },
  ];

  async function toggleFavorite(entry: BookEntryDto, next: boolean) {
    entry.favorite = next; // optimistic
    try {
      await updateBookEntry(entry.id, { favorite: next });
    } catch {
      entry.favorite = !next;
      toast.error("Mise à jour impossible");
    }
  }

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
  subtitle={(n) => `${n} livre${n > 1 ? "s" : ""}`}
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
      onToggleFavorite={(next) => toggleFavorite(entry, next)}>
      {#snippet meta()}
        {#if entry.book.pageCount}
          <ProgressBar value={pct(entry)} />
          <span class="timecode text-xs">
            {entry.currentPage} / {entry.book.pageCount} pages
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
