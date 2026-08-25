<script lang="ts">
  import type { Snippet } from "svelte";
  import { scale } from "svelte/transition";

  let {
    text,
    placement = "top",
    class: className = "",
    children,
  }: {
    /** Shown in the floating bubble. */
    text: string;
    placement?: "top" | "bottom";
    class?: string;
    children: Snippet;
  } = $props();

  const id = `tooltip-${crypto.randomUUID()}`;

  // Touch devices have no real hover, so tapping toggles the bubble instead —
  // checked once, hover capability doesn't change mid-session. On a device
  // that *does* support hover, clicking must stay a no-op for the tooltip
  // (e.g. tapping a disabled button inside shouldn't pin it open and block
  // it from closing on mouseleave).
  const supportsHover =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches;

  // The element wrapping `children` — often a disabled button — is what
  // gets hovered/tapped, not `children` itself: a disabled control doesn't
  // fire mouse events, so listeners live here instead.
  let wrapperEl: HTMLElement | undefined = $state();
  let open = $state(false);
  // Positioned `fixed` from the wrapper's own rect (computed at show-time,
  // not tracked continuously) rather than `absolute` within the wrapper —
  // same reasoning as Dropdown.svelte: a `relative` wrapper is still
  // clipped by any ancestor's `overflow-hidden` (e.g. `.card`), which cut
  // the bubble off whenever a tooltip sat near a section's edge.
  let pos = $state({ top: 0, left: 0 });

  function computePos() {
    if (!wrapperEl) return;
    const rect = wrapperEl.getBoundingClientRect();
    pos = {
      top: placement === "top" ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
    };
  }

  function show() {
    if (!supportsHover) return;
    computePos();
    open = true;
  }
  function hide() {
    if (supportsHover) open = false;
  }
  function tap(e: MouseEvent) {
    if (supportsHover) return;
    e.stopPropagation();
    if (!open) computePos();
    open = !open;
  }
  function closeOnOutsideClick() {
    if (!supportsHover) open = false;
  }
</script>

<svelte:window
  onclick={closeOnOutsideClick}
  onscroll={() => (open = false)}
  onresize={() => (open = false)} />

<span
  bind:this={wrapperEl}
  class="relative {className}"
  role="presentation"
  aria-describedby={id}
  onmouseenter={show}
  onmouseleave={hide}
  onclick={tap}>
  {@render children()}
  {#if open}
    <span
      {id}
      role="tooltip"
      style="top: {pos.top}px; left: {pos.left}px; transform: translate(-50%, {placement ===
      'top'
        ? '-100%'
        : '0%'});"
      transition:scale|global={{ duration: 120, start: 0.9 }}
      class="border-border bg-surface text-fg pointer-events-none fixed z-50 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shadow-lg">
      {text}
    </span>
  {/if}
</span>
