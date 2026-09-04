<script lang="ts">
  import {
    compareToLastKnown,
    readLastKnown,
    writeLastKnown,
  } from "$lib/last-known";
  import { m } from "$lib/paraglide/messages.js";
  import { prefersReducedMotion } from "$lib/motion";
  import { scale } from "svelte/transition";

  let {
    days,
    trackKey,
  }: {
    days: number | undefined;
    /**
     * Storage key enabling the [G6] rise animation, e.g. `streak:<userId>`.
     * Left unset wherever the badge annotates *someone else's* line (review
     * and comment authors): a stranger's streak moving is not news.
     */
    trackKey?: string;
  } = $props();

  const reduced = prefersReducedMotion();

  // Rise only, never a fall. A shorter streak updates the stored value in
  // silence — the "no loss pressure" guardrail is explicit that losing a
  // streak is never notified. Same last-known-value mechanism as the
  // level-up bubble, shared through $lib/last-known.
  const RISE_MS = 900;
  let rising = $state(false);
  $effect(() => {
    if (!trackKey || !days || days <= 0) return;

    const change = compareToLastKnown(readLastKnown(trackKey), days);
    writeLastKnown(trackKey, days);
    if (change !== "up") return;

    rising = true;
    const timer = setTimeout(() => (rising = false), RISE_MS);
    return () => clearTimeout(timer);
  });
</script>

{#if days && days > 0}
  <span
    in:scale|global={{ duration: reduced ? 0 : 200, start: 0.6 }}
    class="text-accent inline-flex items-center gap-0.5 align-middle text-xs font-bold"
    title={days === 1
      ? m.streak_days_one({ days })
      : m.streak_days_many({ days })}>
    <span aria-hidden="true" class={rising ? "streak-rise inline-block" : ""}
      >🎬</span
    >{days}
  </span>
{/if}

<style>
  /* prefers-reduced-motion is handled globally in app.css (every animation
     duration forced near-zero). */
  .streak-rise {
    animation: streak-rise 700ms ease-out;
  }

  @keyframes streak-rise {
    0% {
      transform: scale(1);
    }
    30% {
      transform: scale(1.35) rotate(-6deg);
    }
    60% {
      transform: scale(0.96) rotate(3deg);
    }
    100% {
      transform: scale(1);
    }
  }
</style>
