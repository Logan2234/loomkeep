<script lang="ts">
  // A value that rolls like an odometer when it changes: the new figure
  // enters from below when it goes up, from above when it goes down. Unlike
  // CountFlash, this is for values the reader is actively changing (a vote,
  // a rating being dragged), where the direction of the change is the point.
  import { prefersReducedMotion } from "$lib/motion";
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  let {
    value,
    class: cls = "",
  }: {
    /** `null` renders an en dash and counts as below every number. */
    value: number | null;
    class?: string;
  } = $props();

  const DURATION_MS = 220;
  const reduced = prefersReducedMotion();

  let direction = $state(1);
  let previous: number | null = null;

  $effect.pre(() => {
    const current = value;
    direction = (current ?? -1) >= (previous ?? -1) ? 1 : -1;
    previous = current;
  });

  const motion = () => ({
    duration: reduced ? 0 : DURATION_MS,
    easing: cubicOut,
  });
</script>

<span class="inline-grid overflow-clip {cls}">
  {#key value}
    <span
      class="[grid-area:1/1]"
      in:fly={{ ...motion(), y: `${direction * 70}%` }}
      out:fly={{ ...motion(), y: `${direction * -70}%` }}>
      {value ?? "–"}
    </span>
  {/key}
</span>
