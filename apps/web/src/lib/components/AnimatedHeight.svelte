<script lang="ts">
  // Eases its own height to follow its content's, so a panel whose content
  // swaps (a wizard step, a form section) grows and shrinks smoothly instead
  // of snapping. Pair it with cross-fading children stacked in one grid cell
  // ([grid-area:1/1]): while both are mounted the cell takes the taller one,
  // then this settles on the one that stays. The 1-unit inset keeps focus
  // rings clear of the clip.
  import { prefersReducedMotion } from "#lib/motion.js";
  import type { Snippet } from "svelte";

  let { children, class: cls = "" }: { children: Snippet; class?: string } =
    $props();

  const reduced = prefersReducedMotion();
  let inner = $state<HTMLDivElement>();
  let height = $state<number | null>(null);

  $effect(() => {
    if (!inner) return;
    const target = inner;
    const observer = new ResizeObserver(() => {
      height = target.offsetHeight;
    });
    observer.observe(target);
    return () => observer.disconnect();
  });
</script>

<!-- No explicit height until the first measure: the initial render lays out
     naturally rather than animating up from zero. -->
<div
  class="{reduced
    ? ''
    : 'transition-[height] duration-250 ease-out'} -m-1 overflow-hidden {cls}"
  style:height={height === null ? undefined : `${height}px`}>
  <div bind:this={inner} class="grid p-1">
    {@render children()}
  </div>
</div>
