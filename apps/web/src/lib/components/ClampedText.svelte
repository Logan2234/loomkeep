<script lang="ts">
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { tick } from "svelte";

  // A paragraph clamped to a few lines, with "Voir plus" / "Voir moins" when
  // it overflows — the height animated between both states, the way
  // ReviewCard unfolds a review.
  let {
    text,
    lines = 2,
    class: cls = "",
  }: {
    text: string;
    lines?: number;
    class?: string;
  } = $props();

  const RESIZE_MS = 260;
  const RESIZE_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
  const reduced = prefersReducedMotion();

  let el = $state<HTMLParagraphElement>();
  let expanded = $state(false);
  let overflowing = $state(false);
  let resizing = false;

  $effect(() => {
    void text;
    if (!el || expanded) return;
    overflowing = el.scrollHeight > el.clientHeight + 1;
  });

  function clampedHeight(node: HTMLElement): number {
    return Math.round(parseFloat(getComputedStyle(node).lineHeight) * lines);
  }

  // line-clamp can't be transitioned: the height is animated explicitly,
  // and the clamp (with its ellipsis) only comes back once collapsed.
  async function toggle() {
    if (!el || resizing) return;
    if (reduced) {
      expanded = !expanded;
      return;
    }

    const from = el.offsetHeight;
    resizing = true;
    if (expanded) {
      const collapse = el.animate(
        [{ height: `${from}px` }, { height: `${clampedHeight(el)}px` }],
        { duration: RESIZE_MS, easing: RESIZE_EASING, fill: "forwards" },
      );
      await collapse.finished;
      expanded = false;
      await tick();
      collapse.cancel();
    } else {
      expanded = true;
      await tick();
      await el.animate(
        [{ height: `${from}px` }, { height: `${el.scrollHeight}px` }],
        { duration: RESIZE_MS, easing: RESIZE_EASING },
      ).finished;
    }
    resizing = false;
  }
</script>

<p
  bind:this={el}
  class="overflow-hidden {cls}"
  style={expanded
    ? undefined
    : `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${lines};`}>
  {text}
</p>
{#if overflowing || expanded}
  <button
    type="button"
    class="text-accent hover:text-accent/80 mt-1 text-xs font-semibold transition-colors"
    aria-expanded={expanded}
    onclick={toggle}>
    {expanded ? m.common_see_less() : m.common_see_more()}
  </button>
{/if}
