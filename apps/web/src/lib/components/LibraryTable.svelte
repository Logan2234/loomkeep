<script lang="ts" generics="T">
  // The table and compact modes of LibraryBrowser. Below md a table doesn't
  // fit, so both render as rows: a thumbnail (table) or text only (compact)
  // with the status, rating and progress on one line.
  import { goto } from "$app/navigation";
  import { joinMeta } from "$lib/format";
  import type {
    LibraryColumn,
    LibraryItemView,
    LibrarySelection,
  } from "$lib/library-view";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { MediaQuery } from "svelte/reactivity";
  import { flip } from "svelte/animate";
  import { fade, scale } from "svelte/transition";
  import Icon from "./Icon.svelte";
  import Poster from "./Poster.svelte";
  import ProgressBar from "./ProgressBar.svelte";

  let {
    items,
    keyOf,
    itemView,
    columns,
    sort,
    reversed,
    onSort,
    selection,
    compact = false,
  }: {
    items: T[];
    keyOf: (entry: T) => string;
    itemView: (entry: T) => LibraryItemView;
    columns: LibraryColumn<T>[];
    sort: string;
    /** Ascending order, as LibraryBrowser's "↑" toggle. */
    reversed: boolean;
    /** Header click: the column's sort, reversed when already active. */
    onSort: (sort: string) => void;
    selection: LibrarySelection<T>;
    compact?: boolean;
  } = $props();

  const wide = new MediaQuery("min-width: 768px");
  const reduced = prefersReducedMotion();

  // In selection mode a click anywhere on the row (title link included)
  // toggles it; otherwise the row opens the entry like its title does.
  function onRowClick(e: MouseEvent, entry: T, href: string) {
    const target = e.target as HTMLElement;
    if (selection.active) {
      if (target.closest("input")) return;
      e.preventDefault();
      selection.toggle(entry, e.shiftKey);
      return;
    }
    if (target.closest("a, button")) return;
    void goto(href);
  }

  function rowMeta(item: LibraryItemView): string {
    return joinMeta(
      compact ? item.subtitle : null,
      item.status.label,
      item.rating !== null ? `★ ${item.rating}` : null,
      item.progress?.label,
      item.progress?.paused ? m.media_status_paused() : null,
    );
  }
</script>

{#snippet favorite(item: LibraryItemView)}
  <button
    type="button"
    onclick={() => item.onToggleFavorite(!item.favorite)}
    title={item.favorite ? m.common_favorite_remove() : m.common_favorite_add()}
    aria-label={item.favorite
      ? m.common_favorite_remove()
      : m.common_favorite_add()}
    aria-pressed={item.favorite}
    class="hover:text-fg relative grid h-8 w-8 shrink-0 place-items-center rounded-full transition-[color,transform] active:scale-90 {item.favorite
      ? 'text-accent'
      : 'text-dim'}">
    {#key item.favorite}
      <span in:scale|global={{ duration: reduced ? 0 : 200, start: 0.5 }}>
        <Icon
          name="star"
          class="h-4 w-4 {item.favorite ? 'fill-accent' : ''}" />
      </span>
    {/key}
  </button>
{/snippet}

{#snippet checkbox(entry: T, title: string)}
  <input
    type="checkbox"
    class="accent-accent relative z-1 h-4 w-4 shrink-0 cursor-pointer"
    checked={selection.has(entry)}
    aria-label={title}
    in:scale={{ duration: reduced ? 0 : 150, start: 0.5 }}
    onclick={(e) => {
      e.stopPropagation();
      selection.toggle(entry, e.shiftKey);
    }} />
{/snippet}

{#snippet status(item: LibraryItemView)}
  <span
    class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap {item
      .status.cls}">
    {item.status.label}
  </span>
{/snippet}

{#if wide.current}
  <div class="border-border bg-surface overflow-x-auto rounded-xl border">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr>
          {#if selection.active}
            <th scope="col" class="bg-surface-2 w-10 pl-3">
              <input
                type="checkbox"
                class="accent-accent h-4 w-4 cursor-pointer"
                checked={selection.allLoaded}
                indeterminate={selection.someLoaded}
                aria-label={m.common_select_all()}
                onchange={selection.toggleLoaded} />
            </th>
          {/if}
          {#each columns as column (column.label)}
            {@const active = column.sort === sort}
            <th
              scope="col"
              class="bg-surface-2 text-dim px-3 text-xs font-semibold whitespace-nowrap {compact
                ? 'py-2'
                : 'py-2.5'} {column.numeric ? 'text-right' : 'text-left'}"
              aria-sort={active
                ? reversed
                  ? "ascending"
                  : "descending"
                : undefined}>
              {#if column.sort}
                <button
                  type="button"
                  class="hover:text-fg inline-flex items-center gap-1 transition-colors {active
                    ? 'text-fg'
                    : ''}"
                  onclick={() => onSort(column.sort!)}>
                  {column.label}
                  <Icon
                    name="chevron-down"
                    class="h-3 w-3 transition-[transform,opacity] duration-200 {active
                      ? 'text-accent opacity-100'
                      : 'opacity-0'} {active && reversed
                      ? 'rotate-180'
                      : ''}" />
                </button>
              {:else}
                {column.label}
              {/if}
            </th>
          {/each}
          {#if !selection.active}
            <th scope="col" class="bg-surface-2 w-12">
              <span class="sr-only">{m.common_favorite()}</span>
            </th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each items as entry (keyOf(entry))}
          {@const item = itemView(entry)}
          {@const on = selection.active && selection.has(entry)}
          <tr
            class="border-border [&:active:not(:has(button:active))]:bg-accent/10 has-[:focus-visible]:bg-surface-2 cursor-pointer border-t transition-[background-color,box-shadow] has-[:focus-visible]:shadow-[inset_3px_0_0_var(--color-accent)] {on
              ? 'bg-accent/10'
              : 'hover:bg-surface-2'}"
            data-library-item={keyOf(entry)}
            onclick={(e) => onRowClick(e, entry, item.href)}
            animate:flip={{ duration: reduced ? 0 : 250 }}
            in:fade|global={{ duration: reduced ? 0 : 150 }}
            out:fade={{ duration: reduced ? 0 : 100 }}>
            {#if selection.active}
              <td class="w-10 pl-3">{@render checkbox(entry, item.title)}</td>
            {/if}
            {#each columns as column (column.label)}
              <td
                class="px-3 align-middle {compact
                  ? 'py-1.5'
                  : 'py-2'} {column.numeric
                  ? 'text-right font-mono tabular-nums'
                  : ''}">
                {#if column.kind === "title"}
                  <div class="flex min-w-56 items-center gap-3">
                    {#if !compact}
                      <div class="w-8 shrink-0 overflow-hidden rounded">
                        <Poster
                          src={item.imageUrl}
                          title={item.title}
                          alt=""
                          caption={false} />
                      </div>
                    {/if}
                    <div
                      class="min-w-0 {compact
                        ? 'flex items-baseline gap-2'
                        : ''}">
                      <a
                        href={item.href}
                        class="hover:text-accent font-semibold transition-colors focus-visible:outline-none">
                        {item.title}
                      </a>
                      {#if item.subtitle}
                        <span
                          class="text-dim text-xs {compact
                            ? 'truncate'
                            : 'block'}">
                          {item.subtitle}
                        </span>
                      {/if}
                    </div>
                  </div>
                {:else if column.kind === "status"}
                  {@render status(item)}
                {:else if column.kind === "progress"}
                  {#if item.progress}
                    <div class="flex min-w-40 items-center gap-2">
                      <ProgressBar
                        value={item.progress.percent}
                        label={m.common_selection_summary({
                          label: m.common_progress(),
                          selection: item.title,
                        })}
                        class="min-w-16 flex-1" />
                      <span class="timecode text-xs whitespace-nowrap">
                        {item.progress.label}
                      </span>
                      {#if item.progress.paused}
                        <span
                          class="border-border text-dim rounded border px-1 font-mono text-[0.65rem] whitespace-nowrap">
                          {m.media_status_paused()}
                        </span>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-dim">—</span>
                  {/if}
                {:else if column.kind === "rating"}
                  {#if item.rating !== null}
                    ★ {item.rating}
                  {:else}
                    <span class="text-dim">—</span>
                  {/if}
                {:else if column.kind === "text"}
                  {@const value = column.value(entry)}
                  <span class="whitespace-nowrap {value ? '' : 'text-dim'}">
                    {value ?? "—"}
                  </span>
                {/if}
              </td>
            {/each}
            {#if !selection.active}
              <td class="px-2 {compact ? 'py-0.5' : 'py-1'}">
                {@render favorite(item)}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <ul
    class="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
    {#each items as entry (keyOf(entry))}
      {@const item = itemView(entry)}
      {@const on = selection.active && selection.has(entry)}
      <!-- The row click is a pointer shortcut: keyboard users reach the same
           actions through the title link and the checkbox. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
      <li
        class="[&:active:not(:has(button:active))]:bg-accent/10 has-[:focus-visible]:bg-surface-2 relative flex items-center gap-3 px-3 transition-[background-color,box-shadow] has-[:focus-visible]:shadow-[inset_3px_0_0_var(--color-accent)] {compact
          ? 'py-2'
          : 'py-2.5'} {on ? 'bg-accent/10' : 'hover:bg-surface-2'}"
        data-library-item={keyOf(entry)}
        onclick={(e) => onRowClick(e, entry, item.href)}
        animate:flip={{ duration: reduced ? 0 : 250 }}
        in:fade|global={{ duration: reduced ? 0 : 150 }}
        out:fade={{ duration: reduced ? 0 : 100 }}>
        {#if selection.active}
          {@render checkbox(entry, item.title)}
        {/if}
        {#if !compact}
          <div class="w-9 shrink-0 overflow-hidden rounded">
            <Poster
              src={item.imageUrl}
              title={item.title}
              alt=""
              caption={false} />
          </div>
        {/if}
        <div class="min-w-0 flex-1">
          <a
            href={item.href}
            class="block truncate text-sm font-semibold after:absolute after:inset-0 focus-visible:outline-none">
            {item.title}
          </a>
          <p class="text-dim truncate font-mono text-xs">{rowMeta(item)}</p>
          {#if !compact && item.progress && item.progress.percent < 100}
            <ProgressBar
              value={item.progress.percent}
              height="h-1"
              label={m.common_selection_summary({
                label: m.common_progress(),
                selection: item.title,
              })}
              class="mt-1.5" />
          {/if}
        </div>
        {#if !selection.active}
          <div class="relative z-1">{@render favorite(item)}</div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
