<script lang="ts">
  import { listBooks } from "$lib/api/client";
  import type { LibraryLoadParams } from "$lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import ReadingGoalChip from "$lib/components/ReadingGoalChip.svelte";
  import BookSearchPanel from "$lib/components/search/BookSearchPanel.svelte";
  import {
    BOOK_STATUS_LABELS,
    BOOK_STATUS_ORDER,
  } from "$lib/constants/status-labels";
  import { Domain, type BookEntryDto } from "@loomkeep/shared";

  const STATUS_OPTIONS = BOOK_STATUS_ORDER.map((value) => ({
    label: BOOK_STATUS_LABELS[value],
    value,
  }));

  const SORTS = [
    { label: "Ajout récent", value: "added" },
    { label: "Titre", value: "title" },
    { label: "Auteur", value: "author" },
    { label: "Note", value: "rating" },
    { label: "Nombre de pages", value: "pages" },
    { label: "Progression de lecture", value: "progress" },
    { label: "Terminé récemment", value: "finished" },
    { label: "Commencé récemment", value: "started" },
    { label: "Statut", value: "status" },
  ];

  function load(params: LibraryLoadParams) {
    return listBooks({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      sort: params.sort,
      order: params.order,
      page: params.page,
    });
  }
</script>

<LibraryBrowser
  icon="book"
  title="Livres"
  subtitle={(n) => `${n} livre${n > 1 ? "s" : ""}`}
  noun="livre"
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
      favorite={entry.favorite}>
      {#snippet meta()}
        <span class="timecode text-xs">
          {BOOK_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
            · ★ {entry.rating}{/if}
        </span>
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
