<script lang="ts">
  // Shown while the one-shot bootstrap (session + runtime config) resolves,
  // so a reload lands on something rather than an empty page. It only ever
  // appears before the first `bootstrap.ready` — SPA navigations don't re-run
  // the bootstrap — and on an explicit reconnect retry. The share target
  // reuses it, with a message, while it looks the shared link up.
  import { m } from "#lib/paraglide/messages.js";

  let {
    message,
    class: cls = "min-h-[100svh]",
  }: {
    /** Said under the reel; without one, only screen readers hear "loading". */
    message?: string;
    /** Height: full screen by default, less when shown under the app chrome. */
    class?: string;
  } = $props();
</script>

<div
  class="boot-splash flex {cls} flex-col items-center justify-center gap-8 px-6"
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

  {#if message}
    <p class="timecode -mt-2 text-sm">{message}</p>
  {:else}
    <span class="sr-only">{m.common_loading()}</span>
  {/if}
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
