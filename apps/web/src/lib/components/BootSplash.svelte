<script lang="ts">
  // Shown while the one-shot bootstrap (session + runtime config) resolves,
  // so a reload lands on something rather than an empty page. It only ever
  // appears before the first `bootstrap.ready` — SPA navigations don't re-run
  // the bootstrap — and on an explicit reconnect retry.
  //
  // "Séance": a film reel, turning. The amber isn't standing in for anything
  // here — it's just the brand accent on a shape that reads as cinema on
  // sight, which earlier passes (a leader reticle, a lit gate) did not.
  import { m } from "$lib/paraglide/messages.js";
</script>

<div
  class="boot-splash flex min-h-[100svh] flex-col items-center justify-center gap-8 px-6"
  role="status"
  aria-live="polite">
  <p class="font-display text-2xl font-extrabold tracking-tight">
    {m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span>
  </p>

  <svg viewBox="0 0 100 100" class="boot-reel h-16 w-16" aria-hidden="true">
    <g class="boot-reel-body">
      <circle cx="50" cy="50" r="45" />
      <circle cx="50" cy="24" r="11" />
      <circle cx="72.5" cy="63" r="11" />
      <circle cx="27.5" cy="63" r="11" />
      <circle class="boot-reel-hub" cx="50" cy="50" r="7" />
    </g>
  </svg>

  <span class="sr-only">{m.common_loading()}</span>
</div>

<style>
  /* Held back so a warm cache doesn't flash the splash for 80ms — it only
     becomes visible once the bootstrap is actually taking a moment. */
  .boot-splash {
    opacity: 0;
    animation: boot-splash-in 200ms ease-out 250ms forwards;
  }

  .boot-reel-body {
    fill: none;
    stroke: var(--accent);
    stroke-width: 3;
    transform-origin: 50% 50%;
    animation: boot-spin 2.4s linear infinite;
  }

  .boot-reel-hub {
    fill: var(--accent);
  }

  @keyframes boot-splash-in {
    to {
      opacity: 1;
    }
  }

  @keyframes boot-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .boot-splash {
      animation-duration: 1ms;
    }

    /* The reel sits still rather than turning. */
    .boot-reel-body {
      animation: none;
    }
  }
</style>
