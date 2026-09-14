<script lang="ts" generics="T">
  // Content-agnostic horizontal scroll-snap strip, shared by every "row of
  // cards" in the app (related titles, cast, home dashboard resume strips...).
  // Navigation adapts to the input: on hover-capable pointers (desktop) the
  // edges reveal prev/next arrows; on coarse/touch pointers native swipe drives
  // it and a row of tappable page dots gives the affordance arrows can't.
  // Callers supply their own per-item markup via the `card` snippet.
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { Snippet } from "svelte";
  import { onDestroy } from "svelte";
  import { flip } from "svelte/animate";
  import {
    getAdjacentCarouselOffset,
    getCarouselPageIndex,
    getCarouselPageOffsets,
  } from "./carousel-pagination";
  import Icon from "./Icon.svelte";

  let {
    items,
    keyOf,
    card,
    label,
    gap = "gap-4",
    wrapClass = "-mx-5 md:mx-0",
    innerClass = "px-5 pt-2 pb-2 md:px-0",
    snapPad = "scroll-pl-5 md:scroll-pl-0",
  }: {
    items: T[];
    keyOf: (item: T) => string;
    card: Snippet<[T]>;
    /** Accessible name for the scrollable collection. */
    label: string;
    /** Tailwind gap class between cards — cast strips use a tighter gap-3. */
    gap?: string;
    /** Outer negative-margin/breakpoint class, tuned to the page gutter. */
    wrapClass?: string;
    /** Inner scroll-track padding, tuned to the surrounding layout. */
    innerClass?: string;
    /** Scroll-snap padding — must match the inner left padding so the first
     * card snaps flush to the gutter instead of hiding it. */
    snapPad?: string;
  } = $props();

  let stripEl = $state<HTMLDivElement | null>(null);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);
  let dragging = $state(false);
  // Coarse pointer (touch): swap the hover-only arrows for tappable page dots.
  let coarse = $state(false);
  let pageCount = $state(1);
  let pageIndex = $state(0);

  function updateEdges() {
    const el = stripEl;
    if (!el) return;
    canScrollLeft = el.scrollLeft > 4;
    canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
    const offsets = getCarouselPageOffsets(el.scrollWidth, el.clientWidth);
    pageCount = offsets.length;
    pageIndex = getCarouselPageIndex(el.scrollLeft, offsets);
  }

  function scrollByPage(dir: 1 | -1) {
    const el = stripEl;
    if (!el) return;
    const offsets = getCarouselPageOffsets(el.scrollWidth, el.clientWidth);
    el.scrollTo({
      left: getAdjacentCarouselOffset(el.scrollLeft, offsets, dir),
      behavior: reduced ? "auto" : "smooth",
    });
  }

  function scrollToPage(i: number) {
    const el = stripEl;
    if (!el) return;
    const offsets = getCarouselPageOffsets(el.scrollWidth, el.clientWidth);
    el.scrollTo({
      left: offsets[i] ?? 0,
      behavior: reduced ? "auto" : "smooth",
    });
  }

  /** Imperative reset for callers who reorder `items` (e.g. "just watched"
   * bumping an entry to the front) and want the strip back at its start. */
  export function scrollToStart() {
    stripEl?.scrollTo({ left: 0, behavior: reduced ? "auto" : "smooth" });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByPage(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByPage(1);
    }
  }

  $effect(() => {
    void items;
    updateEdges();
    const el = stripEl;
    if (!el) return;
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    window.addEventListener("resize", updateEdges);
    // Reflect the pointer type so the arrows/dots choice tracks a device that
    // switches modes (e.g. a 2-in-1 laptop) rather than only the first render.
    const mql = window.matchMedia("(hover: none)");
    const syncCoarse = () => (coarse = mql.matches);
    syncCoarse();
    mql.addEventListener("change", syncCoarse);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateEdges);
      mql.removeEventListener("change", syncCoarse);
    };
  });

  // Drag-to-pan (mouse only — touch keeps its native swipe scroll). A real
  // drag (the strip actually ended up scrolled somewhere else) suppresses
  // the click on whatever's underneath so panning doesn't accidentally
  // trigger a link/button. Listens on window (not pointer capture) so the
  // click that follows keeps its normal hit-tested target — pointer capture
  // retargets that click to the strip itself, silently swallowing it.
  let dragged = false;
  let startX = 0;
  let startScroll = 0;

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0 || !stripEl) return;
    // Nothing to pan (row fits without overflow) — skip drag tracking
    // entirely so ordinary mouse jitter during a click never gets
    // mistaken for a drag and cancels the underlying link/button.
    if (stripEl.scrollWidth <= stripEl.clientWidth) return;
    dragging = true;
    startX = e.clientX;
    startScroll = stripEl.scrollLeft;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function removePointerListeners() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e: PointerEvent) {
    if (!stripEl) return;
    stripEl.scrollLeft = startScroll - (e.clientX - startX);
  }

  // Checked once, from the strip's actual net displacement, rather than
  // latching on any single transient movement sample — a mouse click is
  // rarely perfectly still, and momentary overshoot below this threshold
  // must not get mistaken for a deliberate pan.
  function onPointerUp() {
    dragging = false;
    dragged = stripEl ? Math.abs(stripEl.scrollLeft - startScroll) > 4 : false;
    removePointerListeners();
  }

  function onClickCapture(e: MouseEvent) {
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
    }
    dragged = false;
  }

  const reduced = prefersReducedMotion();
  onDestroy(removePointerListeners);
</script>

{#if items.length > 0}
  <div class="group relative {wrapClass}">
    <!-- Drag-to-pan is a progressive enhancement over native scroll/touch;
         the strip's content (links/buttons) stays independently reachable. -->
    <div
      bind:this={stripEl}
      role="region"
      aria-label={label}
      tabindex="0"
      class="no-scrollbar focus-visible:outline-accent flex snap-x {gap} {innerClass} {snapPad} overflow-x-auto select-none focus-visible:outline-2 focus-visible:outline-offset-2 {dragging
        ? 'cursor-grabbing'
        : 'cursor-grab'}"
      onscroll={updateEdges}
      onpointerdown={onPointerDown}
      onkeydown={onKeydown}
      onclickcapture={onClickCapture}>
      {#each items as item (keyOf(item))}
        <div
          class="w-fit shrink-0 snap-start"
          animate:flip={{ duration: reduced ? 0 : 250 }}>
          {@render card(item)}
        </div>
      {/each}
    </div>

    {#if !coarse && canScrollLeft}
      <button
        type="button"
        aria-label={m.common_previous()}
        class="border-border bg-bg/90 hover:bg-surface-2 absolute top-1/2 left-2 -translate-y-1/2 rounded-full border p-1.5 opacity-0 shadow-md backdrop-blur transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
        onclick={() => scrollByPage(-1)}>
        <Icon name="chevron-left" class="h-4 w-4" />
      </button>
    {/if}
    {#if !coarse && canScrollRight}
      <button
        type="button"
        aria-label={m.common_next()}
        class="border-border bg-bg/90 hover:bg-surface-2 absolute top-1/2 right-2 -translate-y-1/2 rounded-full border p-1.5 opacity-0 shadow-md backdrop-blur transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
        onclick={() => scrollByPage(1)}>
        <Icon name="chevron-right" class="h-4 w-4" />
      </button>
    {/if}
  </div>

  {#if coarse && pageCount > 1}
    <!-- Touch affordance: page dots (arrows are hover-only and unreachable). -->
    <div class="mt-1 flex justify-center gap-0.5">
      {#each { length: pageCount } as _, i (i)}
        <button
          type="button"
          aria-label={m.common_page_number({ page: i + 1 })}
          aria-current={i === pageIndex ? "true" : undefined}
          onclick={() => scrollToPage(i)}
          class="grid h-8 min-w-8 place-items-center rounded-full">
          <span
            class="h-1.5 rounded-full transition-all {i === pageIndex
              ? 'bg-accent w-5'
              : 'bg-border w-1.5'}"></span>
        </button>
      {/each}
    </div>
  {/if}
{/if}
