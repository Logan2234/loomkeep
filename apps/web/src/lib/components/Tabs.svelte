<script lang="ts" generics="T extends string">
  // Underlined tab strip. Scrolls sideways rather than wrapping when the tabs
  // outgrow a phone screen — hence the baseline drawn as an inset shadow: a
  // bottom border pulled under the tabs with a negative margin would be
  // clipped by the scroll container. Pair it with TabPanels for the content.
  import { prefersReducedMotion } from "$lib/motion";

  let {
    tabs,
    current,
    onSelect,
    label,
    idPrefix,
    class: className = "",
  }: {
    tabs: { value: T; label: string }[];
    current: T;
    onSelect: (value: T) => void;
    /** Accessible name of the tab list. */
    label: string;
    /** Ties each tab to its panel: `{idPrefix}-{value}-tab` / `-panel`. */
    idPrefix?: string;
    class?: string;
  } = $props();

  const reduced = prefersReducedMotion();
  const buttons: Partial<Record<T, HTMLButtonElement>> = {};

  // One underline that slides to the active tab, rather than one per tab.
  let indicator = $state<{ left: number; width: number } | null>(null);
  // Off until the first placement has painted, so the underline doesn't
  // sweep in from the left edge when the page loads.
  let animate = $state(false);

  function place() {
    const button = buttons[current];
    if (button) {
      indicator = { left: button.offsetLeft, width: button.offsetWidth };
    }
  }

  $effect(() => {
    void tabs.length;
    place();
  });

  $effect(() => {
    if (!indicator || animate || reduced) return;
    const frame = requestAnimationFrame(() => (animate = true));
    return () => cancelAnimationFrame(frame);
  });

  // Tab widths change once web fonts load and when labels change language.
  $effect(() => {
    void tabs.length;
    const observer = new ResizeObserver(place);
    for (const button of Object.values<HTMLButtonElement | undefined>(
      buttons,
    )) {
      if (button) observer.observe(button);
    }
    return () => observer.disconnect();
  });
</script>

<div
  class="no-scrollbar relative flex gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)] {className}"
  role="tablist"
  aria-label={label}>
  {#each tabs as tab (tab.value)}
    <button
      bind:this={buttons[tab.value]}
      type="button"
      role="tab"
      id={idPrefix ? `${idPrefix}-${tab.value}-tab` : undefined}
      aria-controls={idPrefix ? `${idPrefix}-${tab.value}-panel` : undefined}
      aria-selected={current === tab.value}
      class="shrink-0 border-b-2 border-transparent pb-2.5 text-sm font-bold whitespace-nowrap transition-colors duration-200 {current ===
      tab.value
        ? 'text-fg'
        : 'text-dim'}"
      onclick={() => onSelect(tab.value)}>
      {tab.label}
    </button>
  {/each}

  {#if indicator}
    <span
      aria-hidden="true"
      class="bg-accent pointer-events-none absolute bottom-0 left-0 h-0.5 {animate
        ? 'transition-[transform,width] duration-300 ease-out'
        : ''}"
      style:width="{indicator.width}px"
      style:transform="translateX({indicator.left}px)"></span>
  {/if}
</div>
