<script lang="ts">
  // The message shown under an input when the server rejects that field.
  // Extracted from the six copies of the same markup across the auth pages,
  // so the way an error arrives is decided once: it fades and rises into
  // place instead of appearing between one frame and the next, which is what
  // made a rejected form feel like it had jumped.
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
