<script lang="ts" generics="T">
  import { prefersReducedMotion } from "#lib/motion.js";
  import type { Snippet } from "svelte";
  import { scale } from "svelte/transition";

  let {
    items,
    key,
    label,
    title,
    empty,
    disabled = () => false,
    row,
    onpick,
    oncancel,
  }: {
    items: T[];
    key: (item: T) => string;
    label: string;
    /** Above the items, when they need saying what they are. */
    title?: string;
    /** Said when there's nothing to offer. */
    empty: string;
    /** Shown but not offered: its row says why. */
    disabled?: (item: T) => boolean;
    /** Draws an item; the flag says it's the one Enter picks. */
    row: Snippet<[T, boolean]>;
    onpick: (item: T) => void;
    oncancel: () => void;
  } = $props();

  const reduced = prefersReducedMotion();

  let highlighted = $state<string | null>(null);
  let list = $state<HTMLElement | null>(null);
  const offered = $derived(items.filter((item) => !disabled(item)));

  $effect(() => {
    if (!offered.some((item) => key(item) === highlighted)) {
      highlighted = offered[0] ? key(offered[0]) : null;
    }
  });

  // The list scrolls inside the panel: keep the highlighted item in view.
  $effect(() => {
    void highlighted;
    list
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  });

  /** The composer's keys while the picker is open; true when handled here. */
  export function handleKey(event: KeyboardEvent): boolean {
    if (event.key === "Escape") {
      event.preventDefault();
      oncancel();
      return true;
    }

    const index = offered.findIndex((item) => key(item) === highlighted);
    if (index === -1) return false;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : offered.length - 1;
      highlighted = key(offered[(index + step) % offered.length]);
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      onpick(offered[index]);
      return true;
    }

    return false;
  }
</script>

<div
  transition:scale={{ duration: reduced ? 0 : 150, start: 0.97 }}
  bind:this={list}
  class="border-border bg-surface absolute inset-x-0 bottom-full z-30 mb-2 max-h-72 overflow-y-auto rounded-xl border p-1.5 shadow-xl"
  style="transform-origin: bottom left;">
  {#if title}
    <p
      class="text-dim px-2 pt-1 pb-1.5 font-mono text-[0.65rem] tracking-widest uppercase">
      {title}
    </p>
  {/if}
  {#if items.length > 0}
    <div role="listbox" aria-label={label}>
      {#each items as item (key(item))}
        {@const off = disabled(item)}
        <button
          type="button"
          role="option"
          aria-selected={highlighted === key(item)}
          aria-disabled={off}
          class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150
            {highlighted === key(item) ? 'bg-surface-2' : ''}
            {off ? 'cursor-default opacity-60' : ''}"
          onmousedown={(e) => e.preventDefault()}
          onmouseenter={() => {
            if (!off) highlighted = key(item);
          }}
          onclick={() => {
            if (!off) onpick(item);
          }}>
          {@render row(item, highlighted === key(item))}
        </button>
      {/each}
    </div>
  {:else}
    <p class="text-dim px-2.5 py-2 text-sm" aria-live="polite">{empty}</p>
  {/if}
</div>
