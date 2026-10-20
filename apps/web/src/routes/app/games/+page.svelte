<script lang="ts">
  import { labeledOptions } from "#lib/options.js";

  import { type SelectOption } from "#lib/types/select-option.js";

  import { EMBEDDED_SEARCH_LIMIT } from "#lib/constants/search.js";

  import { page } from "$app/state";
  import { getGamesPile, listGames } from "#lib/api/client.js";
  import {
    bulkDeleteGameEntries,
    bulkUpdateGameEntries,
    listGamePlatforms,
    updateGameEntry,
  } from "#lib/api/games.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import type {
    LibraryLoadParams,
    PileLoadParams,
  } from "#lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "#lib/components/LibraryBrowser.svelte";
  import PosterCard from "#lib/components/PosterCard.svelte";
  import SagasModeSwitch, {
    sagasMode,
  } from "#lib/components/saga/SagasModeSwitch.svelte";
  import GameSearchPanel from "#lib/components/search/GameSearchPanel.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import GameSagasView from "./components/GameSagasView.svelte";
  import {
    GAME_OWNERSHIP_SOURCES,
    GAME_OWNERSHIP_STATUS_OPTIONS,
  } from "#lib/constants/ownership-sources.js";
  import {
    GAME_STATUS_LABELS,
    GAME_STATUS_META,
    GAME_STATUS_ORDER,
  } from "#lib/constants/status-labels.js";
  import { DATE_MEDIUM_OPTIONS, formatDate, formatHours } from "#lib/format.js";
  import {
    ownershipText,
    type LibraryBulkActions,
    type LibraryColumn,
    type LibraryItemView,
    COMMON_LIBRARY_SORTS,
  } from "#lib/library-view.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    Domain,
    isSessionPaused,
    type GameEntryDto,
    type GameSortKey,
    type GameFilterStatus,
    SESSION_FILTER_PAUSED,
  } from "@loomkeep/shared";

  const STATUS_OPTIONS = [
    ...labeledOptions(GAME_STATUS_LABELS, GAME_STATUS_ORDER),
    { label: m.media_status_paused(), value: SESSION_FILTER_PAUSED },
  ];

  const SORTS = [
    { label: COMMON_LIBRARY_SORTS.added, value: "added" },
    { label: COMMON_LIBRARY_SORTS.title, value: "title" },
    { label: COMMON_LIBRARY_SORTS.rating, value: "rating" },
    { label: m.game_playtime(), value: "playtime" },
    { label: COMMON_LIBRARY_SORTS.finished, value: "finished" },
    { label: COMMON_LIBRARY_SORTS.started, value: "started" },
    { label: COMMON_LIBRARY_SORTS.status, value: "status" },
  ] satisfies SelectOption<GameSortKey>[];

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
      key: "platform",
      kind: "text",
      label: m.game_platform_title(),
      value: (e) => e.platform,
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
      statuses: params.statuses as GameFilterStatus[],
      platforms: params.extra as string[],
      sort: params.sort as GameSortKey,
      order: params.order,
      page: params.page,
    });

  const loadPile = (params: PileLoadParams) =>
    getGamesPile({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses as GameFilterStatus[],
      platforms: params.extra as string[],
    });

  const platformsQuery = createApiQuery(() => ({
    key: keys.games.platforms(),
    fetch: listGamePlatforms,
  }));
  const platformOptions = $derived(
    (platformsQuery.data ?? []).map((p) => ({ label: p, value: p })),
  );

  const mode = $derived(sagasMode(page.url));
</script>

{#snippet modeSwitch()}
  <SagasModeSwitch isNew={isFeatureNew("game-sagas")} />
{/snippet}

{#if mode === "sagas"}
  <GameSagasView {modeSwitch} />
{:else}
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
    {platformOptions}
    {setFavorite}>
    {#snippet headerActions()}
      {@render modeSwitch()}
    {/snippet}
    {#snippet catalogPreview(query: string, onResults: (n: number) => void)}
      <GameSearchPanel {query} limit={EMBEDDED_SEARCH_LIMIT} {onResults} />
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
{/if}
