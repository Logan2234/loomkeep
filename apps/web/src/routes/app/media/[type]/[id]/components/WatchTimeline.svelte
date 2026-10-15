<script lang="ts">
  import { DATE_MEDIUM_OPTIONS, formatDate } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { EpisodeWatchDto } from "@loomkeep/shared";
  import { cubicOut } from "svelte/easing";
  import { fade } from "svelte/transition";

  // An episode's viewings as a line of dots, oldest first. A rewatch grows a
  // new dot out of the last one, drawing the line as it travels to its
  // place; undoing it pulls the dot back in (the same transition, reversed).
  let { watches }: { watches: EpisodeWatchDto[] } = $props();

  const reduced = prefersReducedMotion();

  // Matches the item width (w-30) below: how far a new dot travels.
  const STEP = "7.5rem";
  const MS = 420;

  const history = $derived([...watches].reverse());

  function travel(_node: Element, { first }: { first: boolean }) {
    return {
      duration: reduced ? 0 : MS,
      easing: cubicOut,
      css: (t: number) =>
        first
          ? `transform: scale(${t})`
          : `transform: translateX(calc(${STEP} * ${t - 1})) scale(${0.6 + 0.4 * t})`,
    };
  }

  function draw(_node: Element) {
    return {
      duration: reduced ? 0 : MS,
      easing: cubicOut,
      css: (t: number) => `transform: scaleX(${t})`,
    };
  }
</script>

<ol class="flex overflow-x-auto pt-1 pb-1">
  {#each history as watch, i (watch.id)}
    <li class="relative w-30 shrink-0 pr-3">
      {#if i > 0}
        <span
          class="bg-success/50 absolute top-[4px] -left-30 h-0.5 w-30 origin-left"
          aria-hidden="true"
          transition:draw></span>
      {/if}
      <span
        class="bg-success ring-bg relative block h-2.5 w-2.5 rounded-full ring-4"
        aria-hidden="true"
        transition:travel={{ first: i === 0 }}></span>
      <span
        class="block"
        transition:fade={{
          duration: reduced ? 0 : 200,
          delay: reduced ? 0 : 160,
        }}>
        <span class="timecode text-dim mt-2 block text-[0.65rem] uppercase">
          {i === 0 ? m.media_episode_watched() : m.media_episode_rewatched()}
        </span>
        <span class="block text-sm">
          {watch.watchedAt
            ? formatDate(watch.watchedAt, DATE_MEDIUM_OPTIONS)
            : "—"}
        </span>
      </span>
    </li>
  {/each}
</ol>
