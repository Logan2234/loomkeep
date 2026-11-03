<script lang="ts">
  import Modal from "#lib/components/Modal.svelte";
  import { formatNumber } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MediaDetailEpisodeDto } from "@loomkeep/shared";
  import { isAired, type EpisodeTab } from "./episodes";

  let {
    tabs,
    now,
    title,
    onGo,
    onClose,
  }: {
    /** The slices of the cut season. */
    tabs: EpisodeTab[];
    now: Date;
    title: (tab: EpisodeTab) => string;
    onGo: (episodeNumber: number) => void;
    onClose: () => void;
  } = $props();

  let value = $state<number | null>(null);
  let input = $state<HTMLInputElement>();

  const max = $derived(
    Math.max(...tabs.flatMap((t) => t.episodes.map((e) => e.number))),
  );
  const found = $derived.by(() => {
    if (value === null) return null;
    for (const tab of tabs) {
      const episode = tab.episodes.find((e) => e.number === value);
      if (episode) return { tab, episode };
    }
    return null;
  });

  const stateLabel = (episode: MediaDetailEpisodeDto) =>
    episode.watchCount > 0
      ? m.media_goto_state_watched()
      : isAired(episode, now)
        ? m.media_goto_state_unwatched()
        : m.media_goto_state_upcoming();

  function submit(e: Event) {
    e.preventDefault();
    if (found) onGo(found.episode.number);
  }
</script>

<Modal title={m.media_goto_title()} onclose={onClose} initialFocus={input}>
  <form class="flex flex-col gap-3" onsubmit={submit}>
    <label class="flex flex-col gap-1 text-sm">
      {m.media_goto_label({ max: formatNumber(max) })}
      <input
        bind:this={input}
        bind:value
        type="number"
        inputmode="numeric"
        min="1"
        {max}
        class="input" />
    </label>
    <p class="timecode text-dim min-h-4 text-xs" aria-live="polite">
      {#if found}
        {m.media_goto_status({
          number: found.episode.number,
          state: stateLabel(found.episode),
          tab: title(found.tab),
        })}
      {:else if value !== null}
        {m.media_goto_not_found()}
      {/if}
    </p>
    <button type="submit" class="btn btn-primary" disabled={!found}>
      {m.media_goto_submit()}
    </button>
  </form>
</Modal>
