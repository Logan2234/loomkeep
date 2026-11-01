<script lang="ts" generics="T extends string">
  import { type SelectOption } from "#lib/types/select-option.js";

  // Underlined tab strip. Scrolls sideways rather than wrapping when the tabs
  // outgrow a phone screen — hence the baseline drawn as an inset shadow: a
  // bottom border pulled under the tabs with a negative margin would be
  // clipped by the scroll container. Pair it with TabPanels for the content.
  import { layout } from "#lib/layout.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { adjacentTab, listenTabSwipe } from "#lib/tab-swipe.js";

  let {
    tabs,
    current,
    onSelect,
    label,
    idPrefix,
    class: className = "",
    swipe = true,
  }: {
    tabs: (SelectOption<T> & { disabled?: boolean })[];
    current: T;
    onSelect: (value: T) => void;
    /** Accessible name of the tab list. */
    label: string;
    /** Ties each tab to its panel: `{idPrefix}-{value}-tab` / `-panel`. */
    idPrefix?: string;
    class?: string;
    /** Sliding across the page moves between tabs on a touch screen. */
    swipe?: boolean;
  } = $props();

  const reduced = prefersReducedMotion();
  const buttons: Partial<Record<T, HTMLButtonElement>> = {};
  let list = $state<HTMLDivElement>();

  $effect(() => {
    if (!swipe || !layout.compact) return;
    return listenTabSwipe(
      document,
      (step) => {
        const next = adjacentTab(tabs, current, step);
        if (next !== null) onSelect(next);
      },
      // What follows the strip is its content: it follows the finger a little.
      () => {
        const content: HTMLElement[] = [];
        let el = list?.nextElementSibling;
        for (; el; el = el.nextElementSibling) {
          if (el instanceof HTMLElement) content.push(el);
        }
        return content;
      },
    );
  });

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
  bind:this={list}
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
      disabled={tab.disabled}
      class="shrink-0 border-b-2 border-transparent pb-2.5 text-sm font-bold whitespace-nowrap transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 {current ===
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
      style:width={`${indicator.width}px`}
      style:transform={`translateX(${indicator.left}px)`}></span>
  {/if}
</div>
