<script lang="ts" generics="T extends string">
  // Underlined tab strip. Scrolls sideways rather than wrapping when the tabs
  // outgrow a phone screen — hence the baseline drawn as an inset shadow: a
  // bottom border pulled under the tabs with a negative margin would be
  // clipped by the scroll container.
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
</script>

<div
  class="no-scrollbar flex gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)] {className}"
  role="tablist"
  aria-label={label}>
  {#each tabs as tab (tab.value)}
    <button
      type="button"
      role="tab"
      id={idPrefix ? `${idPrefix}-${tab.value}-tab` : undefined}
      aria-controls={idPrefix ? `${idPrefix}-${tab.value}-panel` : undefined}
      aria-selected={current === tab.value}
      class="shrink-0 border-b-2 pb-2.5 text-sm font-bold whitespace-nowrap {current ===
      tab.value
        ? 'border-accent text-fg'
        : 'text-dim border-transparent'}"
      onclick={() => onSelect(tab.value)}>
      {tab.label}
    </button>
  {/each}
</div>
