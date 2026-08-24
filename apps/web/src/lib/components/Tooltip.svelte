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
  let open = $state(false);

  function show() {
    if (supportsHover) open = true;
  }
  function hide() {
    if (supportsHover) open = false;
  }
  function tap(e: MouseEvent) {
    if (supportsHover) return;
    e.stopPropagation();
    open = !open;
  }
  function closeOnOutsideClick() {
    if (!supportsHover) open = false;
  }
</script>

<svelte:window onclick={closeOnOutsideClick} />

<span
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
      transition:scale={{ duration: 120, start: 0.9 }}
      class="border-border bg-surface text-fg pointer-events-none absolute z-50 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shadow-lg {placement ===
      'top'
        ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
        : 'top-full left-1/2 mt-2 -translate-x-1/2'}">
      {text}
    </span>
  {/if}
</span>
