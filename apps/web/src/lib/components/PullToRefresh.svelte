<script lang="ts">
  // Pulling the page down from its top refreshes what's on screen. A WebView
  // has no such gesture of its own, and neither has an installed PWA; a browser
  // tab has Chrome's, so it stays out of there.
  import { prefersReducedMotion } from "#lib/motion.js";
  import { tapFeedback } from "#lib/native/haptics.js";
  import {
    canStartPull,
    PULL_THRESHOLD,
    pullDistance,
  } from "#lib/pull-to-refresh.js";
  import { queryClient } from "#lib/query-client.js";
  import { Capacitor } from "@capacitor/core";

  const MIN_SPIN_MS = 400;
  const reduced = prefersReducedMotion();

  let distance = $state(0);
  let refreshing = $state(false);
  let released = $state(true);

  async function refresh() {
    refreshing = true;
    distance = PULL_THRESHOLD;
    await Promise.all([
      queryClient.invalidateQueries({ refetchType: "active" }),
      new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS)),
    ]);
    refreshing = false;
    distance = 0;
  }

  $effect(() => {
    const enabled =
      Capacitor.isNativePlatform() ||
      matchMedia("(display-mode: standalone)").matches;
    if (!enabled) return;

    let start: { x: number; y: number } | null = null;
    let pulling = false;

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start =
        !refreshing &&
        event.touches.length === 1 &&
        canStartPull(event.target as Element, scrollY)
          ? { x: touch.clientX, y: touch.clientY }
          : null;
      pulling = false;
    };

    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0];
      const dy = touch.clientY - start.y;
      if (!pulling) {
        if (Math.abs(dy) < 8 && Math.abs(touch.clientX - start.x) < 8) return;
        if (dy <= 0 || Math.abs(touch.clientX - start.x) > dy) {
          start = null;
          return;
        }
        pulling = true;
        released = false;
      }
      const next = pullDistance(dy);
      if (distance < PULL_THRESHOLD && next >= PULL_THRESHOLD) tapFeedback();
      distance = next;
    };

    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      start = null;
      released = true;
      if (distance >= PULL_THRESHOLD) void refresh();
      else distance = 0;
    };

    addEventListener("touchstart", onStart, { passive: true });
    addEventListener("touchmove", onMove, { passive: true });
    addEventListener("touchend", onEnd);
    addEventListener("touchcancel", onEnd);
    return () => {
      removeEventListener("touchstart", onStart);
      removeEventListener("touchmove", onMove);
      removeEventListener("touchend", onEnd);
      removeEventListener("touchcancel", onEnd);
    };
  });
</script>

{#if distance > 0}
  <div
    aria-hidden="true"
    class="border-border bg-surface pointer-events-none fixed top-[env(safe-area-inset-top)] left-1/2 z-36 -ml-5 grid h-10 w-10 place-items-center rounded-full border shadow-lg"
    style="transform: translateY({distance - 44}px); opacity: {Math.min(
      distance / PULL_THRESHOLD,
      1,
    )}; transition: {released && !reduced
      ? 'transform 200ms ease-out, opacity 200ms ease-out'
      : 'none'};">
    <svg
      viewBox="0 0 100 100"
      class="h-6 w-6 {refreshing && !reduced ? 'spin' : ''}"
      style={refreshing ? undefined : `transform: rotate(${distance * 4}deg)`}>
      <g fill="none" stroke="var(--accent)" stroke-width="6">
        <circle cx="50" cy="50" r="45" />
        <circle cx="50" cy="24" r="11" />
        <circle cx="72.5" cy="63" r="11" />
        <circle cx="27.5" cy="63" r="11" />
      </g>
    </svg>
  </div>
{/if}

<style>
  .spin {
    animation: spin 1.2s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
