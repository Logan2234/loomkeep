<script lang="ts">
  // "Affichage" menu at the end of a library's sort row: picks how the list
  // is rendered, without adding a row above the results.
  import { isFeatureNew } from "$lib/feature-badges";
  import { LIBRARY_VIEW_MODES, type LibraryViewMode } from "$lib/library-view";
  import { m } from "$lib/paraglide/messages.js";
  import type { IconName } from "$lib/types/icon-name";
  import { MediaQuery } from "svelte/reactivity";
  import Dropdown from "./Dropdown.svelte";
  import Icon from "./Icon.svelte";
  import NewBadge from "./NewBadge.svelte";

  let {
    mode,
    onChange,
    selecting,
    onToggleSelecting,
  }: {
    mode: LibraryViewMode;
    onChange: (mode: LibraryViewMode) => void;
    /** Whether selection mode is on; undefined hides its entry. */
    selecting?: boolean;
    onToggleSelecting?: () => void;
  } = $props();

  // Below md the table renders as rows, and the trigger drops its label.
  const wide = new MediaQuery("min-width: 768px");

  const ICONS: Record<LibraryViewMode, IconName> = {
    cards: "library",
    table: "table",
    wall: "wall",
    compact: "rows",
  };

  function label(value: LibraryViewMode): string {
    switch (value) {
      case "cards":
        return m.library_view_cards();
      case "table":
        return wide.current ? m.library_view_table() : m.library_view_rows();
      case "wall":
        return m.library_view_wall();
      case "compact":
        return m.library_view_compact();
    }
  }
</script>

<Dropdown placement="bottom-end" role="menu" class="min-w-44">
  {#snippet trigger({ open, toggle, onkeydown })}
    <button
      type="button"
      class="border-border text-dim hover:text-fg inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors"
      aria-label={wide.current ? undefined : m.library_display()}
      aria-haspopup="menu"
      aria-expanded={open}
      {onkeydown}
      onclick={toggle}>
      <Icon name={ICONS[mode]} class="h-4 w-4" />
      {#if wide.current}
        {m.library_display()}
        {#if isFeatureNew("library-views")}<NewBadge />{/if}
        <Icon
          name="chevron-right"
          class="h-3.5 w-3.5 transition-transform {open
            ? 'rotate-270'
            : 'rotate-90'}" />
      {/if}
    </button>
  {/snippet}
  {#snippet children({ close })}
    <p
      class="text-dim px-3 pt-2 pb-1 font-mono text-[0.65rem] tracking-widest uppercase">
      {m.library_display()}
    </p>
    {#each LIBRARY_VIEW_MODES as value (value)}
      <button
        role="menuitem"
        class="menu-item {value === mode ? 'text-fg font-semibold' : ''}"
        aria-current={value === mode ? "true" : undefined}
        onclick={() => {
          close();
          onChange(value);
        }}>
        <span class="text-accent grid h-4 w-4 place-items-center">
          {#if value === mode}<Icon name="check" class="h-3.5 w-3.5" />{/if}
        </span>
        <Icon name={ICONS[value]} class="text-dim h-4 w-4" />
        {label(value)}
      </button>
    {/each}
    {#if selecting !== undefined}
      <div class="border-border my-1 border-t"></div>
      <button
        role="menuitem"
        class="menu-item"
        onclick={() => {
          close();
          onToggleSelecting?.();
        }}>
        <span class="grid h-4 w-4"></span>
        <Icon name="check" class="text-dim h-4 w-4" />
        {selecting ? m.library_select_done() : m.library_select_start()}
      </button>
    {/if}
  {/snippet}
</Dropdown>
