<script lang="ts" generics="T extends string">
  // The content side of Tabs: cross-fades from one tab's content to the next.
  // Both panels share one grid cell while they fade, so the page doesn't jump
  // by the outgoing panel's height.
  import { prefersReducedMotion } from "$lib/motion";
  import type { Snippet } from "svelte";
  import { fade } from "svelte/transition";

  let {
    current,
    idPrefix,
    children,
  }: {
    current: T;
    /** Same as the Tabs' — ties the panel back to its tab. */
    idPrefix?: string;
    children: Snippet;
  } = $props();

  const reduced = prefersReducedMotion();
</script>

<div class="grid">
  {#key current}
    <div
      class="col-start-1 row-start-1 min-w-0"
      role={idPrefix ? "tabpanel" : undefined}
      id={idPrefix ? `${idPrefix}-${current}-panel` : undefined}
      aria-labelledby={idPrefix ? `${idPrefix}-${current}-tab` : undefined}
      in:fade={{ duration: reduced ? 0 : 200 }}
      out:fade={{ duration: reduced ? 0 : 150 }}>
      {@render children()}
    </div>
  {/key}
</div>
