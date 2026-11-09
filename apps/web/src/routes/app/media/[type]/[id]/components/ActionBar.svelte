<script lang="ts">
  import AddToListButton from "#lib/components/AddToListButton.svelte";
  import Dropdown from "#lib/components/Dropdown.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import ShareWorkMenuItem from "#lib/components/ShareWorkMenuItem.svelte";
  import Tooltip from "#lib/components/Tooltip.svelte";
  import WorkMoreMenu from "#lib/components/WorkMoreMenu.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { MEDIA_STATUS_META } from "#lib/constants/status-labels.js";
  import { formatDate } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { releaseDigestOff } from "#lib/release-alerts.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { LibraryEntryDto } from "@loomkeep/shared";
  import type { Snippet } from "svelte";
  import { scale } from "svelte/transition";

  // Sticky action bar for the media detail page ("Cinéma minimal"), one row
  // high. Kept to a handful of frequent, glanceable controls — the film's
  // watched toggle, favori/liste, plus a
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
    compact,
    title,
    onAdd,
    onToggleFavorite,
    onToggleWatched,
    onDrop,
    onResume,
    onToggleEpisodeAlerts,
    onToggleRewatch = () => {},
    onRemove,
    onShare,
    socialActions,
  }: {
    entry: LibraryEntryDto | null;
    isMovie: boolean;
    upcoming?: boolean;
    /** A finished show airs no more episodes to be alerted of. */
    airingFinished?: boolean;
    onToggleMovieAlerts?: () => void;
    saving: boolean;
    /** Stuck under the top of the screen: the title takes the status's place. */
    compact: boolean;
    title: string;
    onAdd: () => void;
    onToggleFavorite: () => void;
    onToggleWatched: () => void;
    onDrop: () => void;
    onResume: () => void;
    onToggleEpisodeAlerts: () => void;
    /** Starts a movie's rewatch, or stops a movie's or a series' one. */
    onToggleRewatch?: () => void;
    onRemove: () => void;
    socialActions?: Snippet;
    onShare: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
  const isDropped = $derived(entry?.status === "DROPPED");
  const isWatched = $derived(entry?.status === "COMPLETED");
  // A finished title has nothing left to drop; a rewatch is stopped instead.
  const canDrop = $derived(!isWatched && !entry?.rewatching);
  // Nothing seen yet: dropping it never interrupted anything to resume.
  const neverStarted = $derived(
    isMovie || (entry?.progress?.watchedEpisodes ?? 0) === 0,
  );
  // The first viewing plus every logged rewatch.
  const movieViewings = $derived(1 + (entry?.replays.length ?? 0));
  // With no release summary on, a reminder or a mute would change nothing.
  const digestOff = $derived(releaseDigestOff());

  // Room for the date in one row at 360 dp: no year within the current one.
  const shortDate = (date: string): Intl.DateTimeFormatOptions =>
    new Date(date).getFullYear() === new Date().getFullYear()
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" };
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

{#snippet status(inline: boolean)}
  {#if entry && !isMovie}
    {@const meta = MEDIA_STATUS_META[entry.status]}
    {#if !inline}
      <span
        class="h-2 w-2 shrink-0 rounded-full {entry.status === 'DROPPED'
          ? 'bg-danger'
          : entry.status === 'COMPLETED' || entry.status === 'UP_TO_DATE'
            ? 'bg-success'
            : 'bg-accent'}"></span>
    {/if}
    <span class="truncate">
      <span class={inline ? "" : "font-semibold"}>{meta.label}</span>
      {#if entry.progress}
        · <span class="timecode text-dim"
          >{m.media_watched_of({
            watched: entry.progress.watchedEpisodes,
            total: entry.progress.totalEpisodes,
          })}</span>
      {/if}
    </span>
  {:else if entry && isMovie && upcoming}
    <span class="truncate {digestOff ? 'text-dim' : ''}"
      >{entry.movieReleaseAlertsEnabled
        ? m.media_movie_reminder_active()
        : m.media_movie_reminder_enable()}</span>
    {#if !inline && isFeatureNew("movie-releases")}<NewBadge />{/if}
  {:else if entry && isMovie}
    <span class="truncate">
      {#if isWatched}
        {m.home_mark_seen()}
        {#if movieViewings > 1}<span class="timecode text-dim"
            >×{movieViewings}</span
          >{/if}
        {#if entry.finishedAt}<span class="timecode text-dim"
            >{formatDate(entry.finishedAt, shortDate(entry.finishedAt))}</span
          >{/if}
      {:else if entry.rewatching}
        {m.media_movie_rewatching()}
        <span class="timecode text-dim"
          >{m.media_movie_seen_times({ count: movieViewings })}</span>
      {:else}
        {m.media_not_watched()}
      {/if}
    </span>
  {/if}
{/snippet}

<div
  data-action-bar
  class="bg-bg border-border sticky top-[env(safe-area-inset-top)] z-20 border-b">
  <div
    class="mx-auto flex min-h-14 max-w-5xl items-center gap-2.5 py-2 pr-4 pl-5 md:px-8">
    {#if !entry}
      <button
        class="btn btn-primary shrink-0"
        disabled={saving}
        onclick={onAdd}>
        <Icon name="plus" class="h-4 w-4" />
        {m.library_add()}
      </button>
    {:else if isMovie && upcoming}
      {#snippet movieBell()}
        <button
          type="button"
          class="grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-50 {entry!
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
    {:else if isMovie}
      <button
        type="button"
        class="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-50 {isWatched
          ? 'bg-accent text-accent-fg'
          : 'border-border text-dim border'}"
        disabled={saving}
        title={isWatched ? m.media_mark_unwatched() : m.media_mark_watched()}
        aria-label={isWatched
          ? m.media_mark_unwatched()
          : m.media_mark_watched()}
        onclick={onToggleWatched}>
        <Icon name="check" class="h-5 w-5" />
      </button>
    {/if}

    <!-- Once stuck, the title takes the status's place, the status under it.
         A series' next episode is marked from the bar above the bottom one. -->
    <div class="relative h-10 min-w-0 flex-1">
      <p
        class="absolute inset-0 flex items-center gap-2 text-sm transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none {compact
          ? 'pointer-events-none translate-y-1.5 opacity-0'
          : ''}"
        aria-hidden={compact}>
        {@render status(false)}
      </p>
      <div
        class="absolute inset-0 flex min-w-0 flex-col justify-center transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none {compact
          ? ''
          : 'pointer-events-none translate-y-1.5 opacity-0'}"
        aria-hidden={!compact}>
        <h2 class="font-display truncate text-sm font-bold">{title}</h2>
        {#if entry}
          <p class="text-dim flex min-w-0 text-[0.7rem]">
            {@render status(true)}
          </p>
        {/if}
      </div>
    </div>

    {#if !entry}
      <div class="flex shrink-0 items-center gap-2">
        {#if socialActions}
          <div class="mr-1 flex">{@render socialActions()}</div>
        {/if}
        <WorkMoreMenu onshare={onShare} />
      </div>
    {:else}
      <div class="flex shrink-0 items-center gap-2">
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
                {neverStarted ? m.media_back_to_watch() : m.media_resume()}
              </button>
            {:else if canDrop}
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
            {#if entry.rewatching}
              <button
                role="menuitem"
                type="button"
                class="menu-item"
                onclick={() => {
                  close();
                  onToggleRewatch();
                }}>
                <Icon name="x" class="h-4 w-4" />
                {isMovie
                  ? m.media_rewatch_movie_stop()
                  : m.media_rewatch_stop()}
              </button>
            {:else if isMovie && isWatched}
              <button
                role="menuitem"
                type="button"
                class="menu-item"
                onclick={() => {
                  close();
                  onToggleRewatch();
                }}>
                <Icon name="refresh" class="h-4 w-4" />
                {m.media_rewatch_movie_start()}
                {#if isFeatureNew("rewatch")}
                  <span class="ml-auto"><NewBadge /></span>
                {/if}
              </button>
            {/if}
            <ShareWorkMenuItem
              separated={isDropped || canDrop || entry.rewatching || isMovie}
              onclick={() => {
                close();
                onShare();
              }} />
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
