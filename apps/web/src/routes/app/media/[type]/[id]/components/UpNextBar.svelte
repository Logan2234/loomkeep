<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MediaDetailEpisodeDto } from "@loomkeep/shared";
  import { fly } from "svelte/transition";

  const reduced = prefersReducedMotion();

  let {
    episode,
    code,
    countdown,
    busy,
    onGo,
    onMark,
  }: {
    episode: MediaDetailEpisodeDto;
    code: string;
    /** Set when the episode is only announced: nothing to mark yet. */
    countdown: string | null;
    busy: boolean;
    onGo: () => void;
    onMark: () => void;
  } = $props();

  const label = $derived(
    countdown === null
      ? m.media_up_next({ code })
      : m.media_next_announced({ code }),
  );
</script>

<div
  class="border-border bg-surface flex items-center gap-2 rounded-2xl border p-2 shadow-xl">
  <button
    type="button"
    class="hover:bg-surface-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-colors duration-150"
    aria-label={m.media_go_to_code({ code })}
    onclick={onGo}>
    <span
      class="bg-surface-2 text-dim/60 grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded-md">
      {#if episode.stillUrl}
        <img src={episode.stillUrl} alt="" class="h-full w-full object-cover" />
      {:else}
        <Icon name="tv" class="h-4 w-4" />
      {/if}
    </span>
    {#key code}
      <span
        class="block min-w-0"
        in:fly={{ y: reduced ? 0 : 6, duration: reduced ? 0 : 180 }}>
        <span class="timecode text-dim block truncate text-[0.7rem]"
          >{label}</span>
        <span class="block truncate text-sm font-semibold">
          {episode.title ?? `${m.common_episode()} ${episode.number}`}
        </span>
      </span>
    {/key}
  </button>
  {#if countdown !== null}
    <span
      class="timecode border-border text-dim shrink-0 rounded-lg border px-2.5 py-1 text-xs"
      title={m.media_not_aired()}>
      {countdown}
    </span>
  {:else}
    <button
      type="button"
      class="btn btn-primary h-11 shrink-0"
      disabled={busy}
      aria-label={m.media_mark_watched_code({ code })}
      onclick={onMark}>
      {m.media_episode_watched()}
    </button>
  {/if}
</div>
