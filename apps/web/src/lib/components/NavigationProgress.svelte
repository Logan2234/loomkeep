<script lang="ts">
  import { navigating } from "$app/state";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { fade } from "svelte/transition";

  const reduced = prefersReducedMotion();
</script>

<!-- Only a slow page change shows it: the delay keeps the quick ones quiet. -->
{#if navigating.to}
  <div
    data-navigation-progress
    aria-hidden="true"
    class="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-36 h-0.5 overflow-hidden"
    in:fade={{ delay: reduced ? 0 : 150, duration: reduced ? 0 : 150 }}
    out:fade={{ duration: reduced ? 0 : 120 }}>
    <span class="bg-accent block h-full {reduced ? 'w-full' : 'leader w-1/3'}"
    ></span>
  </div>
{/if}

<style>
  .leader {
    animation: leader 1.1s linear infinite;
  }

  @keyframes leader {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(300%);
    }
  }
</style>
