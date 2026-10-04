<script lang="ts">
  import AddToListButton from "$lib/components/AddToListButton.svelte";
  import Dropdown from "$lib/components/Dropdown.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { formatDate } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { releaseDigestOff } from "$lib/release-alerts";
  import { m } from "$lib/paraglide/messages";
  import type { LibraryEntryDto, NextEpisodeDto } from "@loomkeep/shared";
  import type { Snippet } from "svelte";
  import { scale } from "svelte/transition";

  // Sticky action bar for the media detail page ("Cinéma minimal"). Kept to a
  // handful of frequent, glanceable controls — Continuer/favori/liste, plus a
  // "…" for the rare, set-and-forget actions (alertes, abandonner, retirer).
  // Everything else (note privée, possession) lives in the "Mon suivi" panel
  // further down the page, not here.
  let {
    entry,
    isMovie,
    upcoming = false,
    airingFinished = false,
    onToggleMovieAlerts = () => {},
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
    onToggleEpisodeAlerts,
    onRemove,
    socialActions,
  }: {
    entry: LibraryEntryDto | null;
    isMovie: boolean;
    upcoming?: boolean;
    /** A finished show airs no more episodes to be alerted of. */
    airingFinished?: boolean;
    onToggleMovieAlerts?: () => void;
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
    onToggleEpisodeAlerts: () => void;
    onRemove: () => void;
    socialActions?: Snippet;
  } = $props();

  const reduced = prefersReducedMotion();
  const isDropped = $derived(entry?.status === "DROPPED");
  const isWatched = $derived(entry?.status === "COMPLETED");
  // With no release summary on, a reminder or a mute would change nothing.
  const digestOff = $derived(releaseDigestOff());
</script>

{#snippet digestOffTooltip(control: Snippet, block = false)}
  {#if digestOff}
    <Tooltip
      text={m.release_alerts_channels_off()}
      class={block ? "block w-full" : "inline-flex shrink-0"}>
      {@render control()}
    </Tooltip>
  {:else}
    {@render control()}
  {/if}
{/snippet}

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
      <div class="ml-auto flex items-center gap-2">
        {#if socialActions}
          <div class="mr-1 flex">{@render socialActions()}</div>
        {/if}
        <button class="btn btn-primary" disabled={saving} onclick={onAdd}>
          <Icon name="plus" class="h-4 w-4" />
          {m.library_add()}
        </button>
      </div>
    {:else}
      <div class="flex min-w-0 items-center gap-2.5">
        {#if !isMovie && nextEpisode && !isDropped}
          <button
            type="button"
            class="bg-accent text-accent-fg grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-50"
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
        {:else if isMovie && upcoming}
          {#snippet movieBell()}
            <button
              type="button"
              class="grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-50 {entry!
                .movieReleaseAlertsEnabled
                ? 'bg-accent text-accent-fg'
                : 'border-border text-dim border'}"
              disabled={saving || digestOff}
              aria-pressed={!!entry!.movieReleaseAlertsEnabled}
              aria-label={entry!.movieReleaseAlertsEnabled
                ? m.media_movie_reminder_cancel()
                : m.media_movie_reminder_enable()}
              title={digestOff
                ? undefined
                : entry!.movieReleaseAlertsEnabled
                  ? m.media_movie_reminder_cancel()
                  : m.media_movie_reminder_enable()}
              onclick={onToggleMovieAlerts}>
              <Icon
                name={entry!.movieReleaseAlertsEnabled ? "bell" : "bell-off"}
                class="h-5 w-5" />
            </button>
          {/snippet}
          {@render digestOffTooltip(movieBell)}
          <span class="text-sm {digestOff ? 'text-dim' : ''}"
            >{entry.movieReleaseAlertsEnabled
              ? m.media_movie_reminder_active()
              : m.media_movie_reminder_enable()}</span>
          {#if isFeatureNew("movie-releases")}<NewBadge />{/if}
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
        {#if socialActions}
          <div class="mr-1 flex">{@render socialActions()}</div>
        {/if}
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
          {#snippet trigger({ open, toggle, onkeydown })}
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              {onkeydown}
              aria-label={m.common_more_actions()}
              title={m.common_more_actions()}
              onclick={toggle}
              class="btn-icon border-border h-9 w-9 border transition-colors">
              <Icon name="dots-horizontal" class="h-4 w-4" />
            </button>
          {/snippet}
          {#snippet children({ close })}
            {#if isMovie && entry.movieReleaseAlertsEnabled && !upcoming}
              {#snippet cancelReminder()}
                <button
                  role="menuitem"
                  type="button"
                  class="menu-item"
                  disabled={digestOff}
                  onclick={() => {
                    close();
                    onToggleMovieAlerts();
                  }}>
                  <Icon
                    name="bell-off"
                    class="h-4 w-4" />{m.media_movie_reminder_cancel()}
                </button>
              {/snippet}
              {@render digestOffTooltip(cancelReminder, true)}
            {/if}
            {#if !isMovie && !airingFinished}
              {#snippet episodeAlerts()}
                <button
                  role="menuitem"
                  type="button"
                  class="menu-item"
                  disabled={digestOff}
                  onclick={() => {
                    close();
                    onToggleEpisodeAlerts();
                  }}>
                  <Icon
                    name={entry.episodeAlertsMuted ? "bell" : "bell-off"}
                    class="h-4 w-4" />
                  {entry.episodeAlertsMuted
                    ? m.media_unmute_episode_alerts()
                    : m.media_mute_episode_alerts()}
                  {#if isFeatureNew("episode-alerts-mute")}
                    <span class="ml-auto"><NewBadge /></span>
                  {/if}
                </button>
              {/snippet}
              {@render digestOffTooltip(episodeAlerts, true)}
            {/if}
            {#if isDropped}
              <button
                role="menuitem"
                type="button"
                class="menu-item"
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
                class="menu-item"
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
              class="menu-item menu-item-danger border-border border-t"
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
