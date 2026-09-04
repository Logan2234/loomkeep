<script lang="ts">
  // Fades the routed content back in whenever the path changes.
  //
  // This replaces a first attempt built on the View Transitions API, which
  // kept producing artefacts that were not worth chasing: the browser tweens
  // the snapshot group between the outgoing and incoming heights and scales
  // both captures to fit, so a short page replacing a long one arrived
  // visibly stretched, and the snapshot overlay made the nav rail collapse
  // by firing mouseleave under a stationary cursor.
  //
  // Animating the live element sidesteps all of it: no snapshot, no overlay,
  // nothing to resize, and the nav is never involved. The outgoing page is
  // not cross-faded — at this duration the difference is invisible.
  import { page } from "$app/state";
  import { prefersReducedMotion } from "$lib/motion";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  const FADE_MS = 140;
  const reduced = prefersReducedMotion();

  let node = $state<HTMLDivElement | null>(null);
  let first = true;

  $effect(() => {
    // Tracked so the effect re-runs on navigation; the value is unused.
    void page.url.pathname;

    // The first render is an arrival, not a transition — fading it in would
    // just delay the app's own boot.
    if (first) {
      first = false;
      return;
    }

    if (!node || reduced) return;

    node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FADE_MS,
      easing: "ease-out",
    });
  });
</script>

<div bind:this={node}>{@render children()}</div>
