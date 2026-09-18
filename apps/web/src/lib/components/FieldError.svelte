<script lang="ts">
  import { prefersReducedMotion } from "$lib/motion";
  import { fly } from "svelte/transition";

  let {
    id,
    message,
  }: {
    /** Referenced by the input's `aria-describedby`, where it has one — the
     * checkbox errors on the register form don't. */
    id?: string;
    message: string | undefined;
  } = $props();

  const reduced = prefersReducedMotion();
</script>

{#if message}
  <p
    {id}
    class="text-danger -mt-2 text-xs"
    transition:fly={{ y: reduced ? 0 : -4, duration: reduced ? 0 : 160 }}>
    {message}
  </p>
{/if}
