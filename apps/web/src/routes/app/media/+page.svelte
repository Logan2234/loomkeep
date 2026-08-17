<script lang="ts">
  import { listLibrary } from "$lib/api/client";
  import { updateLibraryEntry } from "$lib/api/library";
  import type { LibraryLoadParams } from "$lib/components/LibraryBrowser.svelte";
  import LibraryBrowser from "$lib/components/LibraryBrowser.svelte";
  import PosterCard from "$lib/components/PosterCard.svelte";
  import MediaSearchPanel from "$lib/components/search/MediaSearchPanel.svelte";
  import { toast } from "$lib/toast.svelte";
  import type { LibraryEntryDto, MediaType } from "@loomkeep/shared";
  import { Domain, isDormant } from "@loomkeep/shared";

  const STATUS_OPTIONS = [
    { label: "En cours", value: "WATCHING" },
    { label: "À voir", value: "PLANNED" },
    { label: "Terminé", value: "COMPLETED" },
    { label: "En pause", value: "DORMANT" },
    { label: "Abandonné", value: "DROPPED" },
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

  function pct(entry: LibraryEntryDto): number {
    if (!entry.progress || entry.progress.totalEpisodes === 0) return 0;
    return Math.round(
      (entry.progress.watchedEpisodes / entry.progress.totalEpisodes) * 100,
    );
  }

  async function toggleFavorite(entry: LibraryEntryDto, next: boolean) {
    entry.favorite = next; // optimistic
    try {
      await updateLibraryEntry(entry.id, { favorite: next });
    } catch {
      entry.favorite = !next;
      toast.error("Mise à jour impossible");
    }
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
  defaultSort="recent">
  {#snippet catalogPreview(query: string, onResults: (n: number) => void)}
    <MediaSearchPanel {query} limit={10} {onResults} />
  {/snippet}
  {#snippet card(entry: LibraryEntryDto)}
    <PosterCard
      href={`/app/media/${entry.mediaItem.type.toLowerCase()}/${entry.mediaItem.sourceId}`}
      src={entry.mediaItem.posterUrl}
      title={entry.mediaItem.title}
      favorite={entry.favorite}
      onToggleFavorite={(next) => toggleFavorite(entry, next)}>
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
