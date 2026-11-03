<script lang="ts">
  import Icon from "#lib/components/Icon.svelte";
  import { formatNumber } from "#lib/format.js";
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { scale } from "svelte/transition";
  import type { EpisodeTab } from "./episodes";

  const reduced = prefersReducedMotion();

  let {
    tabs,
    active,
    tracked,
    selected,
    title,
    onSelect,
    onGoTo,
  }: {
    tabs: EpisodeTab[];
    active: string | null;
    tracked: boolean;
    selected: ReadonlySet<string>;
    /** What a tab shows: "S3", "1–100". */
    title: (tab: EpisodeTab) => string;
    onSelect: (key: string) => void;
    /** Long enough to be cut in slices: a way to jump to an episode. */
    onGoTo?: () => void;
  } = $props();

  let list = $state<HTMLElement>();

  // Keeps the open tab centred, inside the row only: never scrolls the page.
  $effect(() => {
    const row = list;
    const tab = active
      ? row?.querySelector<HTMLElement>(`[data-tab="${active}"]`)
      : null;
    if (!row || !tab) return;
    row.scrollTo?.({
      left: tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2,
      behavior: reduced ? "auto" : "smooth",
    });
  });

  // A mouse has no way to slide the row: arrows, on the sides with more to see.
  let canLeft = $state(false);
  let canRight = $state(false);

  function measure() {
    if (!list) return;
    canLeft = list.scrollLeft > 1;
    canRight = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
  }

  $effect(() => {
    const row = list;
    if (!row || layout.compact) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  });

  function scrollRow(side: -1 | 1) {
    if (!list) return;
    list.scrollBy({
      left: side * list.clientWidth * 0.7,
      behavior: reduced ? "auto" : "smooth",
    });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const at = tabs.findIndex((t) => t.key === active);
    const next = tabs[at + (e.key === "ArrowLeft" ? -1 : 1)];
    if (!next) return;
    e.preventDefault();
    onSelect(next.key);
    list?.querySelector<HTMLElement>(`[data-tab="${next.key}"]`)?.focus();
  }
</script>

<div class="flex items-stretch gap-2">
  {#if onGoTo}
    <button
      type="button"
      class="border-border bg-surface hover:bg-surface-2 timecode h-11 w-11 shrink-0 self-center rounded-xl border text-base font-bold transition-colors duration-150"
      aria-label={m.media_goto_open()}
      title={m.media_goto_open()}
      onclick={onGoTo}>
      #
    </button>
  {/if}
  {#if !layout.compact && canLeft}
    <button
      type="button"
      class="btn-icon self-center"
      aria-label={m.common_previous()}
      onclick={() => scrollRow(-1)}>
      <Icon name="chevron-left" class="h-5 w-5" />
    </button>
  {/if}
  <div
    bind:this={list}
    onscroll={measure}
    role="tablist"
    tabindex="-1"
    aria-label={m.media_episodes()}
    class="relative flex min-w-0 flex-1 [scrollbar-width:none] gap-2 overflow-x-auto py-1"
    onkeydown={onKeydown}>
    {#each tabs as tab (tab.key)}
      {@const open = tab.key === active}
      {@const total = tab.episodes.length}
      {@const watched = tab.episodes.filter((e) => e.watchCount > 0).length}
      {@const ticked = tab.episodes.filter(
        (e) => e.id && selected.has(e.id),
      ).length}
      <button
        type="button"
        role="tab"
        data-tab={tab.key}
        aria-selected={open}
        aria-label={`${title(tab)} · ${
          tracked
            ? m.media_watched_of({ watched, total })
            : m.media_season_episode_count({ count: total })
        }`}
        tabindex={open ? 0 : -1}
        class="bg-surface relative min-h-11 min-w-14 shrink-0 overflow-hidden rounded-lg border-2 px-3 pt-1 pb-1.5 text-center transition-colors duration-150
          {open ? 'border-accent' : 'border-border hover:border-dim/50'}"
        onclick={() => onSelect(tab.key)}>
        <span
          class="block max-w-28 truncate text-sm leading-tight font-semibold">
          {title(tab)}
        </span>
        <span class="timecode text-dim block text-[0.65rem] leading-tight">
          {tracked
            ? `${formatNumber(watched)}/${formatNumber(total)}`
            : m.media_season_episodes_short({ count: total })}
        </span>
        {#if tracked}
          <span class="bg-border absolute inset-x-0 bottom-0 h-[3px]">
            <span
              class="block h-full origin-left transition-transform duration-300 ease-out motion-reduce:transition-none
                {watched === total ? 'bg-success' : 'bg-accent'}"
              style="transform: scaleX({watched / total})"></span>
          </span>
        {/if}
        {#if ticked > 0}
          <span
            class="bg-accent text-bg timecode absolute top-px right-px grid h-3.5 min-w-3.5 place-items-center rounded-full px-0.5 text-[0.55rem] font-bold"
            transition:scale={{ duration: reduced ? 0 : 150, start: 0.95 }}>
            {ticked}
          </span>
        {/if}
      </button>
    {/each}
  </div>
  {#if !layout.compact && canRight}
    <button
      type="button"
      class="btn-icon self-center"
      aria-label={m.common_next()}
      onclick={() => scrollRow(1)}>
      <Icon name="chevron-right" class="h-5 w-5" />
    </button>
  {/if}
</div>
