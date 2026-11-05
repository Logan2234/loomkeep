<script lang="ts">
  // A library's "Filtres et affichage" panel: everything but the statuses,
  // which stay in sight on the toolbar. One set of controls, rising from the
  // bottom on a phone and sliding in from the right on a wide screen. The
  // list behind updates as each control changes; the footer only closes.
  import { TABLET_QUERY } from "#lib/constants/media-queries.js";
  import { layout } from "#lib/layout.svelte.js";
  import {
    LIBRARY_VIEW_MODES,
    type LibraryPosterSize,
    type LibraryViewMode,
  } from "#lib/library-view.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { SelectOption } from "#lib/types/select-option.js";
  import type { Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import Drawer from "./Drawer.svelte";
  import Icon from "./Icon.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import SidePanel from "./SidePanel.svelte";
  import Switch from "./Switch.svelte";

  let {
    onclose,
    total,
    savedViews,
    extraLabel,
    extraOptions = [],
    extra = [],
    onExtra,
    favoritesOnly = $bindable(false),
    sorts,
    sort = $bindable(),
    reversed = $bindable(false),
    mode,
    onMode,
    posterSize,
    onPosterSize,
    onSelect,
    columns,
    onToggleColumn,
    onResetColumns,
    onReset,
  }: {
    onclose: () => void;
    /** How many entries the filters match, for the footer's button. */
    total: number;
    /** The library's saved views, as SavedViewBar renders them. */
    savedViews: Snippet;
    /** The domain's extra filter (media's types, games' platforms), if any. */
    extraLabel?: string;
    extraOptions?: SelectOption[];
    extra?: string[];
    onExtra?: (values: string[]) => void;
    favoritesOnly?: boolean;
    sorts: SelectOption[];
    sort: string;
    reversed?: boolean;
    mode: LibraryViewMode;
    onMode: (mode: LibraryViewMode) => void;
    posterSize: LibraryPosterSize;
    onPosterSize: (size: LibraryPosterSize) => void;
    /** Enters selection mode; undefined where there's none. */
    onSelect?: () => void;
    /** The table's columns and whether each shows; undefined hides the section. */
    columns?: {
      key: string;
      label: string;
      visible: boolean;
      locked: boolean;
    }[];
    onToggleColumn: (key: string) => void;
    onResetColumns: () => void;
    onReset: () => void;
  } = $props();

  // Below md the table renders as rows.
  const wide = new MediaQuery(TABLET_QUERY);

  function modeLabel(value: LibraryViewMode): string {
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

  let drawer = $state<Drawer | null>(null);
  const titleId = "library-filters-title";

  // The drawer animates itself away before calling `onclose`.
  function close() {
    if (drawer) drawer.close();
    else onclose();
  }

  function toggleExtra(value: string) {
    onExtra?.(
      extra.includes(value)
        ? extra.filter((v) => v !== value)
        : [...extra, value],
    );
  }
</script>

{#snippet heading(label: string)}
  <h3
    class="text-dim mt-6 mb-2.5 flex items-center gap-3 font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase">
    {label}<span class="bg-border h-px flex-1"></span>
  </h3>
{/snippet}

{#snippet body()}
  <div
    class="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 md:pt-5">
    <h2 id={titleId} class="font-display text-xl font-extrabold">
      {m.library_filters_title()}
    </h2>
    <button
      type="button"
      class="btn-icon h-9 w-9 rounded-full"
      aria-label={m.common_close()}
      onclick={close}>
      <Icon name="x" class="h-5 w-5" />
    </button>
  </div>

  <div
    data-drawer-scroll
    class="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-4">
    {@render savedViews()}

    {#if extraLabel && (extraOptions.length > 0 || extra.length > 0)}
      {@render heading(extraLabel)}
      <div class="flex flex-wrap gap-2" role="group" aria-label={extraLabel}>
        {#each extraOptions as option (option.value)}
          {@const on = extra.includes(option.value)}
          <button
            type="button"
            class="chip"
            class:chip-on={on}
            aria-pressed={on}
            onclick={() => toggleExtra(option.value)}>
            {option.label}
          </button>
        {/each}
      </div>
    {/if}

    <label
      class="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-3">
      <span class="font-medium">{m.library_favorites_only()}</span>
      <Switch
        checked={favoritesOnly}
        label={m.library_favorites_only()}
        onChange={(next) => (favoritesOnly = next)} />
    </label>

    {@render heading(m.common_sort_by())}
    <div
      class="grid grid-cols-2 gap-x-5"
      role="radiogroup"
      aria-label={m.common_sort_by()}>
      {#each sorts as option (option.value)}
        {@const on = sort === option.value}
        <button
          type="button"
          role="radio"
          aria-checked={on}
          class="hover:bg-surface-2 -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-left transition-colors {on
            ? 'font-semibold'
            : ''}"
          onclick={() => (sort = option.value)}>
          {option.label}
          {#if on}<Icon name="check" class="text-accent h-4.5 w-4.5" />{/if}
        </button>
      {/each}
    </div>
    <SegmentedControl
      class="mt-2"
      label={m.common_reverse_sort()}
      options={[
        { value: "desc", label: `↓ ${m.library_sort_desc()}` },
        { value: "asc", label: `↑ ${m.library_sort_asc()}` },
      ]}
      value={reversed ? "asc" : "desc"}
      onChange={(value) => (reversed = value === "asc")} />

    {@render heading(m.library_display())}
    <SegmentedControl
      label={m.library_display()}
      options={LIBRARY_VIEW_MODES.map((value) => ({
        value,
        label: modeLabel(value),
      }))}
      value={mode}
      onChange={onMode} />
    {#if mode === "cards"}
      <div class="mt-2">
        <SegmentedControl
          label={m.library_poster_size()}
          options={[
            {
              value: "large",
              label: layout.compact
                ? m.library_columns_two()
                : m.library_posters_large(),
            },
            {
              value: "small",
              label: layout.compact
                ? m.library_columns_three()
                : m.library_posters_small(),
            },
          ]}
          value={posterSize}
          onChange={onPosterSize} />
      </div>
    {/if}
    {#if onSelect}
      <button
        type="button"
        class="hover:bg-surface-2 -mx-2 mt-3 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 text-left transition-colors"
        onclick={() => {
          onSelect();
          close();
        }}>
        {m.library_select_start()}
        <Icon name="chevron-right" class="text-dim h-4.5 w-4.5" />
      </button>
    {/if}

    {#if columns}
      {@render heading(m.library_columns())}
      <div class="flex flex-col">
        {#each columns as column (column.key)}
          <label
            class="flex min-h-10 items-center gap-3 {column.locked
              ? 'text-dim'
              : 'cursor-pointer'}">
            <input
              type="checkbox"
              class="accent-accent h-4 w-4"
              checked={column.visible}
              disabled={column.locked}
              onchange={() => onToggleColumn(column.key)} />
            {column.label}
          </label>
        {/each}
      </div>
      <button
        type="button"
        class="link-accent mt-1 text-sm font-semibold"
        onclick={onResetColumns}>
        {m.library_columns_reset()}
      </button>
    {/if}
  </div>

  <div
    class="border-border flex shrink-0 items-center gap-2 border-t px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
    <button type="button" class="btn btn-ghost" onclick={onReset}>
      {m.common_reset()}
    </button>
    <button type="button" class="btn btn-primary flex-1" onclick={close}>
      {total === 1
        ? m.library_show_results_one({ count: total })
        : m.library_show_results_many({ count: total })}
    </button>
  </div>
{/snippet}

{#if layout.compact}
  <Drawer bind:this={drawer} {onclose} labelledby={titleId}>
    {@render body()}
  </Drawer>
{:else}
  <SidePanel {onclose} labelledby={titleId} desktopClass="max-w-sm">
    {@render body()}
  </SidePanel>
{/if}
