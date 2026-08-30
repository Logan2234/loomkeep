<script lang="ts">
  import AddToListButton from "$lib/components/AddToListButton.svelte";
  import Dropdown from "$lib/components/Dropdown.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { formatDate } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages";
  import type { LibraryEntryDto, NextEpisodeDto } from "@loomkeep/shared";
  import { scale } from "svelte/transition";

  // Sticky action bar for the media detail page ("Cinéma minimal"). Kept to a
  // handful of frequent, glanceable controls — Continuer/favori/liste, plus a
  // "…" for the two rare, consequential actions (abandonner, retirer).
  // Everything else (note privée, possession) lives in the "Mon suivi" panel
  // further down the page, not here.
  let {
    entry,
    isMovie,
    saving,
    nextEpisode,
    continuing,
    compact,
    title,
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
    /** Scrolled past the hero — reveal the title inline. */
    compact: boolean;
    title: string;
    onAdd: () => void;
    onToggleFavorite: () => void;
    onContinue: () => void;
    onToggleWatched: () => void;
    onDrop: () => void;
    onResume: () => void;
    onRemove: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
  const isDropped = $derived(entry?.status === "DROPPED");
  const isWatched = $derived(entry?.status === "COMPLETED");
</script>

<div class="bg-bg border-border sticky top-0 z-20 border-b">
  <div
    class="mx-auto flex max-w-4xl flex-wrap items-center gap-x-2.5 gap-y-2 px-5 py-3 md:px-8">
    <h2
      class="font-display hidden shrink-0 overflow-hidden text-sm font-bold whitespace-nowrap transition-all duration-300 ease-out sm:block {compact
        ? 'max-w-48 opacity-100'
        : 'max-w-0 opacity-0'}">
      {title}
    </h2>

    {#if !entry}
      <button class="btn btn-primary ml-auto" disabled={saving} onclick={onAdd}>
        <Icon name="plus" class="h-4 w-4" />
        {m.library_add()}
      </button>
    {:else}
      <div class="flex min-w-0 items-center gap-2.5">
        {#if !isMovie && nextEpisode && !isDropped}
          <button
            type="button"
            class="bg-accent text-accent-fg grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-50"
            disabled={continuing}
            title={`${m.common_continue()} S${String(nextEpisode.seasonNumber).padStart(2, "0")}E${String(
              nextEpisode.episodeNumber,
            ).padStart(2, "0")}`}
            onclick={onContinue}>
            <Icon name="chevron-right" class="h-5 w-5" />
          </button>
          <div class="text-sm whitespace-nowrap">
            {m.common_continue()} ·
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
              ? 'bg-accent text-accent-fg'
              : 'border-border text-dim border'}"
            disabled={saving}
            title={isWatched
              ? m.media_mark_unwatched()
              : m.media_mark_watched()}
            onclick={onToggleWatched}>
            <Icon name="check" class="h-5 w-5" />
          </button>
          <div class="text-sm whitespace-nowrap">
            {#if isWatched}
              {m.home_mark_seen()}
              <span class="text-dim"
                >{entry.finishedAt
                  ? `(${formatDate(entry.finishedAt)})`
                  : ""}</span>
            {:else}
              {m.media_not_watched()}
            {/if}
          </div>
        {/if}
      </div>

      <div class="ml-auto flex shrink-0 items-center gap-2.5">
        <AddToListButton targetType="MEDIA" targetId={entry.mediaItem.id} />

        <button
          type="button"
          aria-pressed={entry.favorite}
          disabled={saving}
          title={entry.favorite
            ? m.common_favorite_remove()
            : m.common_favorite_add()}
          aria-label={entry.favorite
            ? m.common_favorite_remove()
            : m.common_favorite_add()}
          onclick={onToggleFavorite}
          class="btn-icon h-9 w-9 border {entry.favorite
            ? 'border-accent text-accent'
            : 'border-border text-dim hover:bg-surface-2 hover:text-fg'}">
          {#key entry.favorite}
            <span in:scale|global={{ duration: reduced ? 0 : 200, start: 0.5 }}>
              <Icon
                name="star"
                class="h-4 w-4 {entry.favorite ? 'fill-accent' : ''}" />
            </span>
          {/key}
        </button>

        <Dropdown placement="bottom-end" class="min-w-64">
          {#snippet trigger({ open, toggle })}
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={m.media_more_actions()}
              title={m.media_more_actions()}
              onclick={toggle}
              class="btn-icon border-border h-9 w-9 border">
              <Icon name="dots-horizontal" class="h-4 w-4" />
            </button>
          {/snippet}
          {#snippet children({ close })}
            {#if isDropped}
              <button
                role="menuitem"
                type="button"
                class="hover:bg-surface-2 flex w-full items-center gap-2 px-3 py-2 text-left text-sm whitespace-nowrap"
                onclick={() => {
                  close();
                  onResume();
                }}>
                <Icon name="refresh" class="h-4 w-4" />
                {m.media_resume()}
              </button>
            {:else}
              <button
                role="menuitem"
                type="button"
                class="hover:bg-surface-2 flex w-full items-center gap-2 px-3 py-2 text-left text-sm whitespace-nowrap"
                onclick={() => {
                  close();
                  onDrop();
                }}>
                <Icon name="archive" class="h-4 w-4" />
                {m.media_drop_tracking()}
              </button>
            {/if}
            <button
              role="menuitem"
              type="button"
              class="hover:bg-surface-2 text-danger border-border flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm whitespace-nowrap"
              onclick={() => {
                close();
                onRemove();
              }}>
              <Icon name="trash" class="h-4 w-4" />
              {m.tracking_remove()}
            </button>
          {/snippet}
        </Dropdown>
      </div>
    {/if}
  </div>
</div>
