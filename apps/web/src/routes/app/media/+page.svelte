<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getLibraryPile, listLibrary } from "$lib/api/client";
  import {
    bulkDeleteLibraryEntries,
    bulkUpdateLibraryEntries,
    updateLibraryEntry,
  } from "$lib/api/library";
  import type {
    LibraryLoadParams,
    PileLoadParams,
  } from "$lib/components/LibraryBrowser.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import MediaSearchPanel from "$lib/components/search/MediaSearchPanel.svelte";
  import SagasView from "./components/SagasView.svelte";
  import {
    MEDIA_OWNERSHIP_SOURCES,
    MEDIA_OWNERSHIP_STATUS_OPTIONS,
  } from "$lib/constants/ownership-sources";
  import { MEDIA_STATUS_META } from "$lib/constants/status-labels";
  import { isFeatureNew } from "$lib/feature-badges";
  import { DATE_MEDIUM_OPTIONS, formatDate } from "$lib/format";
  import {
    ownershipText,
    type LibraryBulkActions,
    type LibraryColumn,
    type LibraryItemView,
  } from "$lib/library-view";
  import { m } from "$lib/paraglide/messages";
  import type { LibraryEntryDto, MediaType } from "@loomkeep/shared";
  import {
    Domain,
    isDormant,
    isGhost,
    MEDIA_BULK_STATUSES,
  } from "@loomkeep/shared";

  const STATUS_OPTIONS = [
    { label: m.library_status_in_progress(), value: "WATCHING" },
    { label: m.media_status_planned(), value: "PLANNED" },
    { label: m.library_status_completed(), value: "COMPLETED" },
    { label: m.media_status_paused(), value: "DORMANT" },
    { label: m.media_status_ghost(), value: "GHOST" },
    { label: m.library_status_dropped(), value: "DROPPED" },
  ];

  const STATUS_LABELS = Object.fromEntries(
    STATUS_OPTIONS.map((o) => [o.value, o.label]),
  ) as Record<string, string>;

  const SORTS = [
    { label: m.media_sort_watched(), value: "recent" },
    { label: m.library_sort_added(), value: "added" },
    { label: m.common_title(), value: "title" },
    { label: m.library_rating(), value: "rating" },
    { label: m.stats_progression(), value: "progress" },
    { label: m.library_sort_finished(), value: "finished" },
    { label: m.library_sort_started(), value: "started" },
    { label: m.common_status(), value: "status" },
  ];

  function pct(entry: LibraryEntryDto): number {
    if (!entry.progress || entry.progress.totalEpisodes === 0) return 0;
    return Math.round(
      (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
    );
  }

  const TYPE_LABELS: Record<MediaType, string> = {
    MOVIE: m.media_movie(),
    SERIES: m.media_series(),
    ANIME: m.media_anime(),
  };

  const mediaHref = (entry: LibraryEntryDto) =>
    `/app/media/${entry.mediaItem.type.toLowerCase()}/${entry.mediaItem.sourceId}`;

  const setFavorite = (entry: LibraryEntryDto, next: boolean) =>
    updateLibraryEntry(entry.id, { favorite: next });

  const itemView = (entry: LibraryEntryDto): LibraryItemView => ({
    upcoming: entry.mediaItem.upcoming,
    href: mediaHref(entry),
    title: entry.mediaItem.title,
    subtitle: TYPE_LABELS[entry.mediaItem.type],
    imageUrl: entry.mediaItem.posterUrl,
    status: {
      value: entry.status,
      ...MEDIA_STATUS_META[entry.status],
      ...(entry.mediaItem.upcoming ? { label: m.media_upcoming() } : {}),
    },
    ownership: entry.ownershipStatus,
    ownershipSource: entry.ownershipSource,
    reviewTarget: { type: "MEDIA", id: entry.mediaItem.id },
    rating: entry.rating,
    favorite: entry.favorite,
    progress: entry.progress
      ? {
          percent: pct(entry),
          label: `${entry.progress.watchedEpisodes} / ${entry.progress.totalEpisodes} ${m.media_episode_short()}`,
          paused: isDormant(entry),
          ghost: isGhost(entry),
        }
      : null,
  });

  const COLUMNS: LibraryColumn<LibraryEntryDto>[] = [
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
          MEDIA_OWNERSHIP_STATUS_OPTIONS,
          e.ownershipStatus,
          e.ownershipSource,
        ),
    },
    {
      key: "watched",
      kind: "text",
      label: m.library_col_watched(),
      sort: "recent",
      value: (e) =>
        e.lastWatchedAt
          ? formatDate(e.lastWatchedAt, DATE_MEDIUM_OPTIONS)
          : null,
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
    statusOptions: MEDIA_BULK_STATUSES.map((value) => ({
      value,
      label: MEDIA_STATUS_META[value].label,
    })),
    ownershipOptions: MEDIA_OWNERSHIP_STATUS_OPTIONS,
    ownershipSources: MEDIA_OWNERSHIP_SOURCES,
    update: (dto) =>
      bulkUpdateLibraryEntries(
        dto as Parameters<typeof bulkUpdateLibraryEntries>[0],
      ),
    remove: bulkDeleteLibraryEntries,
  };

  // The sagas view lives in the URL, so a link or "back" lands on it again.
  const mode = $derived(
    page.url.searchParams.get("vue") === "sagas" ? "sagas" : "works",
  );

  function setMode(next: "works" | "sagas") {
    void goto(next === "sagas" ? "?vue=sagas" : page.url.pathname, {
      keepFocus: true,
      noScroll: true,
    });
  }

  const load = (params: LibraryLoadParams) =>
    listLibrary({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      types: params.extra as MediaType[],
      sort: params.sort,
      order: params.order,
      page: params.page,
    });

  const loadPile = (params: PileLoadParams) =>
    getLibraryPile({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      types: params.extra as MediaType[],
    });
</script>

{#snippet modeSwitch()}
  <div class="flex items-center gap-2">
    {#if isFeatureNew("library-sagas")}<NewBadge />{/if}
    <SegmentedControl
      label={m.media_view_label()}
      options={[
        { value: "works", label: m.media_view_works(), icon: "library" },
        { value: "sagas", label: m.media_view_sagas(), icon: "list" },
      ]}
      value={mode}
      onChange={setMode} />
  </div>
{/snippet}

{#if mode === "sagas"}
  <SagasView {modeSwitch} />
{:else}
  <LibraryBrowser
    icon="tv"
    title={m.common_Media()}
    subtitle={(n) =>
      n === 1
        ? m.media_library_count_one({ count: n })
        : m.media_library_count_many({ count: n })}
    noun="titre"
    domain={Domain.MEDIA}
    {load}
    {loadPile}
    keyOf={(e) => e.id}
    statusOptions={STATUS_OPTIONS}
    sorts={SORTS}
    defaultSort="recent"
    {itemView}
    columns={COLUMNS}
    bulk={BULK}
    {setFavorite}>
    {#snippet headerActions()}
      {@render modeSwitch()}
    {/snippet}
    {#snippet catalogPreview(query: string, onResults: (n: number) => void)}
      <MediaSearchPanel {query} limit={10} {onResults} />
    {/snippet}
    {#snippet card(
      entry: LibraryEntryDto,
      onToggleFavorite: (next: boolean) => void,
    )}
      <PosterCard
        href={mediaHref(entry)}
        src={entry.mediaItem.posterUrl}
        title={entry.mediaItem.title}
        favorite={entry.favorite}
        {onToggleFavorite}>
        {#snippet meta()}
          {#if entry.progress}
            <ProgressBar
              value={pct(entry)}
              label={m.common_selection_summary({
                label: m.common_progress(),
                selection: entry.mediaItem.title,
              })} />
            <span class="timecode text-xs">
              {entry.progress.watchedEpisodes} / {entry.progress.totalEpisodes}
              {m.media_episode_short()}
              {#if isGhost(entry)}
                <span class="text-dim inline-flex items-center gap-1"
                  >· <Icon
                    name="ghost"
                    class="h-3 w-3" />{m.media_status_ghost()}</span>
              {:else if isDormant(entry)}
                <span class="text-dim">{m.media_paused_suffix()}</span>
              {/if}
            </span>
          {:else}
            <span class="timecode text-xs">
              {entry.mediaItem.upcoming
                ? m.media_upcoming()
                : STATUS_LABELS[entry.status]}{#if entry.rating !== null}
                · ★ {entry.rating}{/if}
            </span>
          {/if}
        {/snippet}
      </PosterCard>
    {/snippet}
  </LibraryBrowser>
{/if}
