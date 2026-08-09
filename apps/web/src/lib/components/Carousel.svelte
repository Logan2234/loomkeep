<script lang="ts" generics="T">
  // Content-agnostic horizontal scroll-snap strip, shared by every "row of
  // cards" in the app (related titles, cast, home dashboard resume strips...).
  // Navigation adapts to the input: on hover-capable pointers (desktop) the
  // edges reveal prev/next arrows; on coarse/touch pointers native swipe drives
  // it and a row of tappable page dots gives the affordance arrows can't.
  // Callers supply their own per-item markup via the `card` snippet.
  import { m } from "$lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";
  import type { Snippet } from "svelte";

  let {
    items,
    keyOf,
    card,
    gap = "gap-4",
    wrapClass = "-mx-5 md:mx-0",
    innerClass = "px-5 pt-2 pb-2 md:px-0",
    snapPad = "scroll-pl-5 md:scroll-pl-0",
  }: {
    items: T[];
    keyOf: (item: T) => string;
    card: Snippet<[T]>;
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
    // One "page" ≈ one viewport of cards; used only for the touch dots. Keep the
    // count in a local — reading the `pageCount` state back here would make the
    // measuring $effect depend on state it writes and loop forever.
    const pages = Math.max(1, Math.round(el.scrollWidth / el.clientWidth));
    pageCount = pages;
    pageIndex = Math.min(pages - 1, Math.round(el.scrollLeft / el.clientWidth));
  }

  function scrollByPage(dir: 1 | -1) {
    const el = stripEl;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  function scrollToPage(i: number) {
    const el = stripEl;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  /** Imperative reset for callers who reorder `items` (e.g. "just watched"
   * bumping an entry to the front) and want the strip back at its start. */
  export function scrollToStart() {
    stripEl?.scrollTo({ left: 0, behavior: "smooth" });
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
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  function onClickCapture(e: MouseEvent) {
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
    }
    dragged = false;
  }
</script>

{#if items.length > 0}
  <div class="group relative {wrapClass}">
    <!-- Drag-to-pan is a progressive enhancement over native scroll/touch;
         the strip's content (links/buttons) stays independently reachable. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={stripEl}
      class="no-scrollbar flex snap-x {gap} {innerClass} {snapPad} overflow-x-auto select-none {dragging
        ? 'cursor-grabbing'
        : 'cursor-grab'}"
      onscroll={updateEdges}
      onpointerdown={onPointerDown}
      onclickcapture={onClickCapture}>
      {#each items as item (keyOf(item))}
        {@render card(item)}
      {/each}
    </div>

    {#if !coarse && canScrollLeft}
      <button
        type="button"
        aria-label={m.common_previous()}
        class="border-border bg-bg/90 hover:bg-surface-2 absolute top-1/2 left-2 -translate-y-1/2 rounded-full border p-1.5 opacity-0 shadow-md backdrop-blur transition-opacity group-hover:opacity-100"
        onclick={() => scrollByPage(-1)}>
        <Icon name="chevron-left" class="h-4 w-4" />
      </button>
    {/if}
    {#if !coarse && canScrollRight}
      <button
        type="button"
        aria-label={m.common_next()}
        class="border-border bg-bg/90 hover:bg-surface-2 absolute top-1/2 right-2 -translate-y-1/2 rounded-full border p-1.5 opacity-0 shadow-md backdrop-blur transition-opacity group-hover:opacity-100"
        onclick={() => scrollByPage(1)}>
        <Icon name="chevron-right" class="h-4 w-4" />
      </button>
    {/if}
  </div>

  {#if coarse && pageCount > 1}
    <!-- Touch affordance: page dots (arrows are hover-only and unreachable). -->
    <div class="mt-2 flex justify-center gap-1.5">
      {#each { length: pageCount } as _, i (i)}
        <button
          type="button"
          aria-label={`Aller à la page ${i + 1}`}
          aria-current={i === pageIndex ? "true" : undefined}
          onclick={() => scrollToPage(i)}
          class="h-1.5 rounded-full transition-all {i === pageIndex
            ? 'bg-accent w-5'
            : 'bg-border w-1.5'}">
        </button>
      {/each}
    </div>
  {/if}
{/if}
