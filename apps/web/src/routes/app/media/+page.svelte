<script lang="ts">
  import { listLibrary } from "$lib/api/client";
  import Combobox from "$lib/components/Combobox.svelte";
  import type { LibraryLoadParams } from "$lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import MediaSearchPanel from "$lib/components/search/MediaSearchPanel.svelte";
  import type { LibraryEntryDto, MediaType } from "@loomkeep/shared";
  import { Domain, isDormant } from "@loomkeep/shared";

  const STATUS_OPTIONS = [
    { label: "En cours", value: "WATCHING" },
    { label: "À voir", value: "PLANNED" },
    { label: "Terminé", value: "COMPLETED" },
    // "DORMANT" is not a real status: it's a server-side refinement over
    // WATCHING (nothing watched for a while) — see isDormant.
    { label: "En pause", value: "DORMANT" },
    { label: "Abandonné", value: "DROPPED" },
  ];

  const TYPE_OPTIONS: { label: string; value: MediaType }[] = [
    { label: "Films", value: "MOVIE" },
    { label: "Séries", value: "SERIES" },
    { label: "Animés", value: "ANIME" },
  ];

  const TYPE_LABELS: Record<MediaType, string> = {
    MOVIE: "Film",
    SERIES: "Série",
    ANIME: "Animé",
  };

  const SORTS = [
    { label: "Vu récemment", value: "recent" },
    { label: "Ajout récent", value: "added" },
    { label: "Titre", value: "title" },
    { label: "Note", value: "rating" },
    { label: "Progression", value: "progress" },
    { label: "Terminé récemment", value: "finished" },
    { label: "Commencé récemment", value: "started" },
    { label: "Statut", value: "status" },
  ];

  // Extra "type" filter, owned by the page and passed to LibraryBrowser.
  let types = $state<MediaType[]>([]);

  function pct(entry: LibraryEntryDto): number {
    if (!entry.progress || entry.progress.totalEpisodes === 0) return 0;
    return Math.round(
      (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
    );
  }

  function load(params: LibraryLoadParams) {
    return listLibrary({
      query: params.query,
      favorite: params.favoritesOnly,
      statuses: params.statuses,
      types: params.extra as MediaType[],
      sort: params.sort,
      order: params.order,
      page: params.page,
    });
  }
</script>

<LibraryBrowser
  icon="tv"
  title="Vidéo"
  subtitle={(n) => `${n} titre${n > 1 ? "s" : ""}`}
  noun="titre"
  domain={Domain.MEDIA}
  {load}
  keyOf={(e) => e.id}
  statusOptions={STATUS_OPTIONS}
  sorts={SORTS}
  defaultSort="recent"
  extraActive={types.length > 0}
  extra={types}
  onClearExtra={() => (types = [])}>
  {#snippet extraFilters()}
    <Combobox
      label="Type"
      multiselect
      options={TYPE_OPTIONS}
      values={types}
      onChange={(v) => (types = v as MediaType[])} />
  {/snippet}
  {#snippet catalogPreview(query: string, onResults: (n: number) => void)}
    <MediaSearchPanel {query} limit={10} {onResults} />
  {/snippet}
  {#snippet card(entry: LibraryEntryDto)}
    <PosterCard
      href={`/app/media/${entry.mediaItem.type.toLowerCase()}/${entry.mediaItem.sourceId}`}
      src={entry.mediaItem.posterUrl}
      title={entry.mediaItem.title}
      favorite={entry.favorite}>
      {#snippet meta()}
        {#if entry.progress}
          <div class="bg-surface-2 h-1.5 overflow-hidden rounded-full">
            <div class="bg-accent h-full" style={`width: ${pct(entry)}%`}></div>
          </div>
          <span class="timecode text-xs">
            {entry.progress.watchedEpisodes} / {entry.progress.totalEpisodes} ép.
            {#if isDormant(entry)}
              <span class="text-dim">· ⏸ En pause</span>
            {/if}
          </span>
        {:else}
          <span class="timecode text-xs">
            {TYPE_LABELS[entry.mediaItem.type]}{#if entry.rating !== null}
              · ★ {entry.rating}{/if}
          </span>
        {/if}
      {/snippet}
    </PosterCard>
  {/snippet}
</LibraryBrowser>
