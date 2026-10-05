<script lang="ts">
  // Mutes a show's release alerts from any of its calendar episodes — the
  // flag lives on the library entry, so it always covers the whole show.
  import Icon from "#lib/components/Icon.svelte";
  import Tooltip from "#lib/components/Tooltip.svelte";
  import { releaseDigestOff } from "#lib/release-alerts.js";
  import { m } from "#lib/paraglide/messages.js";

  let {
    title,
    muted,
    disabled = false,
    onToggle,
    movie = false,
  }: {
    title: string;
    muted: boolean;
    disabled?: boolean;
    onToggle: () => void;
    movie?: boolean;
  } = $props();

  const label = $derived(
    movie
      ? muted
        ? m.media_movie_reminder_enable()
        : m.media_movie_reminder_cancel()
      : muted
        ? m.calendar_unmute_series({ title })
        : m.calendar_mute_series({ title }),
  );
  // With no release summary on, a reminder or a mute would change nothing.
  const digestOff = $derived(releaseDigestOff());
</script>

{#snippet bell()}
  <button
    type="button"
    class="btn-icon-bordered"
    disabled={disabled || digestOff}
    title={digestOff ? undefined : label}
    aria-label={label}
    onclick={onToggle}>
    <Icon name={muted ? "bell-off" : "bell"} class="h-4 w-4" />
  </button>
{/snippet}

{#if digestOff}
  <Tooltip text={m.release_alerts_channels_off()} class="inline-flex shrink-0">
    {@render bell()}
  </Tooltip>
{:else}
  {@render bell()}
{/if}
