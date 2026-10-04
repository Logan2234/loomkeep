<script lang="ts">
  import { getGamesPile, listGames } from "$lib/api/client";
  import {
    bulkDeleteGameEntries,
    bulkUpdateGameEntries,
    updateGameEntry,
  } from "$lib/api/games";
  import type {
    LibraryLoadParams,
    PileLoadParams,
  } from "$lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import GameSearchPanel from "$lib/components/search/GameSearchPanel.svelte";
  import {
    GAME_OWNERSHIP_SOURCES,
    GAME_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/constants/ownership-sources";
  import {
    GAME_STATUS_LABELS,
    GAME_STATUS_META,
    GAME_STATUS_ORDER,
  } from "$lib/constants/status-labels";
  import { DATE_MEDIUM_OPTIONS, formatDate, formatHours } from "$lib/format";
  import {
    ownershipText,
    type LibraryBulkActions,
    type LibraryColumn,
    type LibraryItemView,
  } from "$lib/library-view";
  import { m } from "$lib/paraglide/messages";
  import { Domain, isSessionPaused, type GameEntryDto } from "@loomkeep/shared";

  const STATUS_OPTIONS = [
    ...GAME_STATUS_ORDER.map((value) => ({
      label: GAME_STATUS_LABELS[value],
      value,
    })),
    { label: m.media_status_paused(), value: "PAUSED" },
  ];

  const SORTS = [
    { label: m.library_sort_added(), value: "added" },
    { label: m.common_title(), value: "title" },
    { label: m.library_rating(), value: "rating" },
    { label: m.game_playtime(), value: "playtime" },
    { label: m.library_sort_finished(), value: "finished" },
    { label: m.library_sort_started(), value: "started" },
    { label: m.common_status(), value: "status" },
  ];

  const setFavorite = (entry: GameEntryDto, next: boolean) =>
    updateGameEntry(entry.id, { favorite: next });

  const itemView = (entry: GameEntryDto): LibraryItemView => ({
    upcoming: entry.game.upcoming,
    trackingLocked: entry.game.upcoming,
    href: `/app/games/${entry.game.sourceId}`,
    title: entry.game.title,
    subtitle: null,
    imageUrl: entry.game.coverUrl,
    status: {
      value: entry.status,
      ...GAME_STATUS_META[entry.status],
      ...(entry.game.upcoming ? { label: m.media_upcoming() } : {}),
    },
    ownership: entry.ownershipStatus,
    ownershipSource: entry.ownershipSource,
    reviewTarget: { type: "GAME", id: entry.game.id },
    rating: entry.rating,
    favorite: entry.favorite,
    progress: null,
  });

  const COLUMNS: LibraryColumn<GameEntryDto>[] = [
    { key: "title", kind: "title", label: m.common_title(), sort: "title" },
    { key: "status", kind: "status", label: m.common_status(), sort: "status" },
    {
      key: "playtime",
      kind: "text",
      label: m.game_playtime(),
      sort: "playtime",
      numeric: true,
      value: (e) =>
        e.playtimeMinutes > 0 ? formatHours(e.playtimeMinutes) : null,
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
          GAME_OWNERSHIP_STATUS_OPTIONS,
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
    ownershipOptions: GAME_OWNERSHIP_STATUS_OPTIONS,
    ownershipSources: GAME_OWNERSHIP_SOURCES,
    update: (dto) =>
      bulkUpdateGameEntries(dto as Parameters<typeof bulkUpdateGameEntries>[0]),
    remove: bulkDeleteGameEntries,
  };

  const load = (params: LibraryLoadParams) =>
    listGames({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      sort: params.sort,
      order: params.order,
      page: params.page,
    });

  const loadPile = (params: PileLoadParams) =>
    getGamesPile({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
    });
</script>

<LibraryBrowser
  icon="gamepad"
  title={m.common_Games()}
  subtitle={(n) =>
    n === 1
      ? m.game_library_count_one({ count: n })
      : m.game_library_count_many({ count: n })}
  noun="jeu"
  domain={Domain.GAMES}
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
  {#snippet catalogPreview(query: string, onResults: (n: number) => void)}
    <GameSearchPanel {query} limit={10} {onResults} />
  {/snippet}
  {#snippet card(
    entry: GameEntryDto,
    onToggleFavorite: (next: boolean) => void,
  )}
    <PosterCard
      href={`/app/games/${entry.game.sourceId}`}
      src={entry.game.coverUrl}
      title={entry.game.title}
      favorite={entry.favorite}
      {onToggleFavorite}>
      {#snippet meta()}
        <span class="timecode text-xs">
          {entry.game.upcoming
            ? m.media_upcoming()
            : GAME_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
            · ★ {entry.rating}{/if}{#if isSessionPaused(entry, "PLAYING")}
            {m.media_paused_suffix()}{/if}
        </span>
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
