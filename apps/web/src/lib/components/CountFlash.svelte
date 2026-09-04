<script lang="ts">
  // A number that briefly accents itself when it changes under the reader's
  // eyes — a follower count after following someone, a library count after
  // an add. Only *changes* are marked: the first render is silent, or every
  // page load would flash every counter on screen.
  //
  // Deliberately not a count-up from zero: the value is already correct, and
  // animating the digits would make a settled figure look like it is still
  // being computed.
  import { prefersReducedMotion } from "$lib/motion";

  let {
    value,
    class: cls = "",
  }: {
    value: number;
    class?: string;
  } = $props();

  const FLASH_MS = 700;
  const reduced = prefersReducedMotion();

  let flashing = $state(false);
  let previous: number | null = null;
  $effect(() => {
    const current = value;
    const changed = previous !== null && previous !== current;
    previous = current;
    if (!changed || reduced) return;

    flashing = true;
    const timer = setTimeout(() => (flashing = false), FLASH_MS);
    return () => clearTimeout(timer);
  });
</script>

<span class="{cls} {flashing ? 'count-flash' : ''}">{value}</span>

<style>
  .count-flash {
    animation: count-flash 700ms ease-out;
  }

  @keyframes count-flash {
    0% {
      color: var(--accent);
      transform: scale(1.18);
    }
    100% {
      color: inherit;
      transform: scale(1);
    }
  }
</style>
