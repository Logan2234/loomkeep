<script lang="ts">
  import AddToListButton from "$lib/components/AddToListButton.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import type { LibraryEntryDto, NextEpisodeDto } from "@loomkeep/shared";

  // Sticky action bar for the media detail page ("Cinéma minimal"). Kept to a
  // handful of frequent, glanceable controls — Continuer/favori/bibliothèque/
  // liste, plus a "…" for the two rare, consequential actions (abandonner,
  // retirer). Everything else (note privée, possession) lives in the "Mon
  // suivi" panel further down the page, not here.
  let {
    entry,
    isMovie,
    saving,
    nextEpisode,
    continuing,
    onAdd,
    onToggleFavorite,
    onContinue,
    onToggleWatched,
    onDrop,
    onResume,
    onRemove,
  }: {
    entry: LibraryEntryDto | null;
    isMovie: boolean;
    saving: boolean;
    nextEpisode: NextEpisodeDto | null;
    continuing: boolean;
    onAdd: () => void;
    onToggleFavorite: () => void;
    onContinue: () => void;
    onToggleWatched: () => void;
    onDrop: () => void;
    onResume: () => void;
    onRemove: () => void;
  } = $props();

  let menuOpen = $state(false);
  const isDropped = $derived(entry?.status === "DROPPED");
  const isWatched = $derived(entry?.status === "COMPLETED");
</script>

<svelte:window onclick={() => (menuOpen = false)} />

<div class="bg-bg border-border sticky top-0 z-20 border-b">
  <div class="mx-auto flex max-w-4xl items-center gap-2.5 px-5 py-3 md:px-8">
    {#if !entry}
      <button
        class="btn btn-primary w-full justify-center"
        disabled={saving}
        onclick={onAdd}>
        <Icon name="plus" class="h-4 w-4" /> Ajouter à ma bibliothèque
      </button>
    {:else}
      {#if !isMovie && nextEpisode}
        <button
          type="button"
          class="bg-accent text-accent-fg grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-50"
          disabled={continuing}
          title={`Continuer S${String(nextEpisode.seasonNumber).padStart(2, "0")}E${String(
            nextEpisode.episodeNumber,
          ).padStart(2, "0")}`}
          onclick={onContinue}>
          <Icon name="chevron-right" class="h-5 w-5" />
        </button>
        <div class="min-w-0 flex-1 text-sm">
          Continuer ·
          <b class="timecode">
            S{String(nextEpisode.seasonNumber).padStart(2, "0")}E{String(
              nextEpisode.episodeNumber,
            ).padStart(2, "0")}
          </b>
        </div>
      {:else if isMovie}
        <button
          type="button"
          class="grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-50 {isWatched
            ? 'border-border text-dim border'
            : 'bg-accent text-accent-fg'}"
          disabled={saving}
          title={isWatched ? "Marquer comme non vu" : "Marquer comme vu"}
          onclick={onToggleWatched}>
          <Icon name="check" class="h-5 w-5" />
        </button>
        <div class="min-w-0 flex-1 text-sm">
          {isWatched ? "Vu" : "Pas encore vu"}
        </div>
      {:else}
        <div class="min-w-0 flex-1"></div>
      {/if}

      <button
        type="button"
        aria-pressed={entry.favorite}
        disabled={saving}
        title={entry.favorite ? "Retirer des coups de cœur" : "Coup de cœur"}
        aria-label={entry.favorite
          ? "Retirer des coups de cœur"
          : "Coup de cœur"}
        onclick={onToggleFavorite}
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50 {entry.favorite
          ? 'border-accent text-accent'
          : 'border-border text-dim hover:bg-surface-2 hover:text-fg'}">
        <Icon
          name="star"
          class="h-4 w-4 {entry.favorite ? 'fill-accent' : ''}" />
      </button>

      <!-- Status only — "in the library" is derived from `entry` existing;
           the state-changing action lives in the "…" menu, gated behind a
           confirmation since it discards progress/notes/rating. -->
      <span
        class="border-accent text-accent inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold">
        <Icon name="check" class="h-4 w-4" /> Bibliothèque
      </span>

      <AddToListButton targetType="MEDIA" targetId={entry.mediaItem.id} />

      <div class="relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-label="Plus d'actions"
          title="Plus d'actions"
          onclick={(e) => {
            e.stopPropagation();
            menuOpen = !menuOpen;
          }}
          class="border-border text-dim hover:bg-surface-2 hover:text-fg grid h-9 w-9 place-items-center rounded-full border">
          <Icon name="dots-horizontal" class="h-4 w-4" />
        </button>
        {#if menuOpen}
          <div
            role="menu"
            class="border-border bg-surface absolute top-full right-0 z-30 mt-1.5 min-w-52 overflow-hidden rounded-lg border shadow-lg">
            {#if isDropped}
              <button
                role="menuitem"
                type="button"
                class="hover:bg-surface-2 flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                onclick={() => {
                  menuOpen = false;
                  onResume();
                }}>
                <Icon name="refresh" class="h-4 w-4" /> Reprendre
              </button>
            {:else}
              <button
                role="menuitem"
                type="button"
                class="hover:bg-surface-2 flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                onclick={() => {
                  menuOpen = false;
                  onDrop();
                }}>
                <Icon name="archive" class="h-4 w-4" /> Abandonner ce suivi
              </button>
            {/if}
            <button
              role="menuitem"
              type="button"
              class="hover:bg-surface-2 text-danger border-border flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm"
              onclick={() => {
                menuOpen = false;
                onRemove();
              }}>
              <Icon name="trash" class="h-4 w-4" /> Retirer de ma bibliothèque
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
