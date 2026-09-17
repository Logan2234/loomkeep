<script lang="ts">
  // The one save affordance across settings. Every row here auto-saves, so
  // without this the only proof a change landed was the control's own new
  // position — which is exactly what a failed save also looks like.
  import Icon from "$lib/components/Icon.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { fade } from "svelte/transition";

  let { state }: { state: "idle" | "saving" | "saved" } = $props();

  const reduced = prefersReducedMotion();
</script>

<span
  class="flex items-center {state === 'idle' ? '' : 'h-5'}"
  aria-live="polite">
  {#if state === "saving"}
    <span class="timecode text-xs">{m.common_save_loading()}</span>
  {:else if state === "saved"}
    <span
      class="text-success flex items-center gap-1 text-xs font-semibold"
      transition:fade={{ duration: reduced ? 0 : 150 }}>
      <Icon name="check" class="h-3.5 w-3.5" />
      {m.common_saved()}
    </span>
  {/if}
</span>
