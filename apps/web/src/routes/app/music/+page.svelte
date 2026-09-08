<script lang="ts">
  import { listMusic } from "$lib/api/client";
  import { updateMusicEntry } from "$lib/api/music";
  import type { LibraryLoadParams } from "$lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import MusicSearchPanel from "$lib/components/search/MusicSearchPanel.svelte";
  import {
    MUSIC_STATUS_LABELS,
    MUSIC_STATUS_ORDER,
  } from "$lib/constants/status-labels";
  import { toggleFavorite } from "$lib/favorite-toggle";
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

  const load = (params: LibraryLoadParams) =>
    listMusic({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      sort: params.sort,
      order: params.order,
      page: params.page,
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
  keyOf={(e) => e.id}
  statusOptions={STATUS_OPTIONS}
  sorts={SORTS}
  defaultSort="added">
  {#snippet catalogPreview(query: string, onResults: (n: number) => void)}
    <MusicSearchPanel {query} limit={10} {onResults} />
  {/snippet}
  {#snippet card(entry: MusicEntryDto)}
    <PosterCard
      href={`/app/music/${entry.album.sourceId}`}
      src={entry.album.coverUrl}
      title={entry.album.title}
      favorite={entry.favorite}
      onToggleFavorite={(next) =>
        toggleFavorite(entry, next, (n) =>
          updateMusicEntry(entry.id, { favorite: n }),
        )}>
      {#snippet meta()}
        <span class="timecode text-xs">
          {MUSIC_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
            · ★ {entry.rating}{/if}
        </span>
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
