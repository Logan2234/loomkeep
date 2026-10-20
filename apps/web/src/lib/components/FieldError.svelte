<script lang="ts">
  import { prefersReducedMotion } from "#lib/motion.js";
  import { fly } from "svelte/transition";

  let {
    id,
    message,
    class: className = "-mt-2",
  }: {
    /** Referenced by the input's `aria-describedby`, where it has one — the
     * checkbox errors on the register form don't. */
    id?: string;
    message: string | undefined;
    class?: string;
  } = $props();

  const reduced = prefersReducedMotion();
</script>

{#if message}
  <p
    {id}
    class="text-danger text-xs {className}"
    transition:fly={{ y: reduced ? 0 : -4, duration: reduced ? 0 : 160 }}>
    {message}
  </p>
{/if}
