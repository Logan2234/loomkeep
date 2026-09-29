<script lang="ts">
  import { getMusicPile, listMusic } from "$lib/api/client";
  import {
    bulkDeleteMusicEntries,
    bulkUpdateMusicEntries,
    updateMusicEntry,
  } from "$lib/api/music";
  import type {
    LibraryLoadParams,
    PileLoadParams,
  } from "$lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import MusicSearchPanel from "$lib/components/search/MusicSearchPanel.svelte";
  import { MUSIC_OWNERSHIP_STATUS_OPTIONS } from "$lib/constants/ownership-sources";
  import {
    MUSIC_STATUS_LABELS,
    MUSIC_STATUS_META,
    MUSIC_STATUS_ORDER,
  } from "$lib/constants/status-labels";
  import { toggleFavorite } from "$lib/favorite-toggle";
  import { DATE_MEDIUM_OPTIONS, formatDate } from "$lib/format";
  import {
    ownershipText,
    type LibraryBulkActions,
    type LibraryColumn,
    type LibraryItemView,
  } from "$lib/library-view";
  import { m } from "$lib/paraglide/messages";
  import { Domain, type MusicEntryDto } from "@loomkeep/shared";

  const STATUS_OPTIONS = MUSIC_STATUS_ORDER.map((value) => ({
    label: MUSIC_STATUS_LABELS[value],
    value,
  }));

  const SORTS = [
    { label: m.library_sort_added(), value: "added" },
    { label: m.common_title(), value: "title" },
    { label: m.music_artist(), value: "artist" },
    { label: m.library_rating(), value: "rating" },
    { label: m.music_sort_listened(), value: "finished" },
    { label: m.common_status(), value: "status" },
  ];

  const setFavorite = (entry: MusicEntryDto, next: boolean) =>
    toggleFavorite(entry, next, (n) =>
      updateMusicEntry(entry.id, { favorite: n }),
    );

  const itemView = (entry: MusicEntryDto): LibraryItemView => ({
    href: `/app/music/${entry.album.sourceId}`,
    title: entry.album.title,
    subtitle: entry.album.artists.join(", ") || null,
    imageUrl: entry.album.coverUrl,
    status: MUSIC_STATUS_META[entry.status],
    rating: entry.rating,
    favorite: entry.favorite,
    onToggleFavorite: (next) => setFavorite(entry, next),
    progress: null,
  });

  const COLUMNS: LibraryColumn<MusicEntryDto>[] = [
    { kind: "title", label: m.common_title(), sort: "title" },
    { kind: "status", label: m.common_status(), sort: "status" },
    {
      kind: "rating",
      label: m.library_rating(),
      sort: "rating",
      numeric: true,
    },
    {
      kind: "text",
      label: m.ownership_title(),
      value: (e) =>
        ownershipText(
          MUSIC_OWNERSHIP_STATUS_OPTIONS,
          e.ownershipStatus,
          e.ownershipSource,
        ),
    },
    {
      kind: "text",
      label: m.library_col_listened(),
      sort: "finished",
      value: (e) =>
        e.finishedAt ? formatDate(e.finishedAt, DATE_MEDIUM_OPTIONS) : null,
    },
    {
      kind: "text",
      label: m.library_col_added(),
      sort: "added",
      value: (e) => formatDate(e.createdAt, DATE_MEDIUM_OPTIONS),
    },
  ];

  const BULK: LibraryBulkActions = {
    statusOptions: STATUS_OPTIONS,
    ownershipOptions: MUSIC_OWNERSHIP_STATUS_OPTIONS,
    update: (dto) =>
      bulkUpdateMusicEntries(
        dto as Parameters<typeof bulkUpdateMusicEntries>[0],
      ),
    remove: bulkDeleteMusicEntries,
  };

  const load = (params: LibraryLoadParams) =>
    listMusic({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      sort: params.sort,
      order: params.order,
      page: params.page,
    });

  const loadPile = (params: PileLoadParams) =>
    getMusicPile({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
    });
</script>

<LibraryBrowser
  icon="music"
  title={m.common_Music()}
  subtitle={(n) =>
    n === 1
      ? m.music_library_count_one({ count: n })
      : m.music_library_count_many({ count: n })}
  noun="album"
  domain={Domain.MUSIC}
  {load}
  {loadPile}
  keyOf={(e) => e.id}
  statusOptions={STATUS_OPTIONS}
  sorts={SORTS}
  defaultSort="added"
  {itemView}
  columns={COLUMNS}
  bulk={BULK}>
  {#snippet catalogPreview(query: string, onResults: (n: number) => void)}
    <MusicSearchPanel {query} limit={10} {onResults} />
  {/snippet}
  {#snippet card(entry: MusicEntryDto)}
    <PosterCard
      href={`/app/music/${entry.album.sourceId}`}
      src={entry.album.coverUrl}
      title={entry.album.title}
      favorite={entry.favorite}
      onToggleFavorite={(next) => setFavorite(entry, next)}>
      {#snippet meta()}
        <span class="timecode text-xs">
          {MUSIC_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
            · ★ {entry.rating}{/if}
        </span>
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
