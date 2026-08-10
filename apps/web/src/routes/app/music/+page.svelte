<script lang="ts">
  import { listMusic } from "$lib/api/client";
  import type { LibraryLoadParams } from "$lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import MusicSearchPanel from "$lib/components/search/MusicSearchPanel.svelte";
  import { MUSIC_STATUS_LABELS, MUSIC_STATUS_ORDER } from "$lib/status-labels";
  import { Domain, type MusicEntryDto } from "@loomkeep/shared";

  const STATUS_OPTIONS = MUSIC_STATUS_ORDER.map((value) => ({
    label: MUSIC_STATUS_LABELS[value],
    value,
  }));

  const SORTS = [
    { label: "Ajout récent", value: "added" },
    { label: "Titre", value: "title" },
    { label: "Artiste", value: "artist" },
    { label: "Note", value: "rating" },
    { label: "Écouté récemment", value: "finished" },
    { label: "Statut", value: "status" },
  ];

  function load(params: LibraryLoadParams) {
    return listMusic({
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
  icon="music"
  title="Musique"
  subtitle={(n) => `${n} album${n > 1 ? "s" : ""}`}
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
      favorite={entry.favorite}>
      {#snippet meta()}
        <span class="timecode text-xs">
          {MUSIC_STATUS_LABELS[entry.status]}{#if entry.rating !== null}
            · ★ {entry.rating}{/if}
        </span>
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
