<script lang="ts" generics="T">
  // The table and compact modes of LibraryBrowser. Below md a table doesn't
  // fit, so both render as rows: a thumbnail (table) or text only (compact)
  // with the status, rating and progress on one line.
  import { goto } from "$app/navigation";
  import { joinMeta } from "#lib/format.js";
  import type {
    LibraryColumn,
    LibraryInlineEdit,
    LibraryItemView,
    LibrarySelection,
  } from "#lib/library-view.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { MediaQuery } from "svelte/reactivity";
  import { flip } from "svelte/animate";
  import { fade, scale } from "svelte/transition";
  import Dropdown from "./Dropdown.svelte";
  import Icon from "./Icon.svelte";
  import OwnershipMenuItems from "./OwnershipMenuItems.svelte";
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
    edit,
    onToggleFavorite,
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
    /** In-place editing; only offered on the desktop table, outside selection mode. */
    edit?: LibraryInlineEdit<T>;
    onToggleFavorite: (entry: T, next: boolean) => void;
    compact?: boolean;
  } = $props();

  const wide = new MediaQuery("min-width: 768px");
  const reduced = prefersReducedMotion();
  const editing = $derived(!!edit && !selection.active);

  // An editable value reads as plain text until its row is hovered.
  const EDIT_TRIGGER =
    "hover:bg-accent/10 aria-expanded:bg-accent/15 -mx-1.5 -my-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-[background-color,transform] active:scale-95";

  function justSaved(entry: T, field: "status" | "ownership"): boolean {
    return edit?.saved?.key === keyOf(entry) && edit.saved.field === field;
  }

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

  function pausedLabel(item: LibraryItemView): string {
    return item.progress?.ghost
      ? m.media_status_ghost()
      : m.media_status_paused();
  }

  function rowMeta(item: LibraryItemView): string {
    return joinMeta(
      compact ? item.subtitle : null,
      item.status.label,
      item.rating !== null ? `★ ${item.rating}` : null,
      item.progress?.label,
      item.progress?.paused ? pausedLabel(item) : null,
    );
  }
</script>

{#snippet favorite(entry: T, item: LibraryItemView)}
  <button
    type="button"
    onclick={() => onToggleFavorite(entry, !item.favorite)}
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

{#snippet savedCheck()}
  <span class="saved-check text-success ml-1 inline-flex align-middle">
    <Icon name="check" class="h-3.5 w-3.5" />
  </span>
{/snippet}

{#snippet statusEdit(entry: T, item: LibraryItemView)}
  <Dropdown placement="bottom-start" role="menu" class="min-w-44">
    {#snippet trigger({ open, toggle, onkeydown })}
      <button
        type="button"
        class={EDIT_TRIGGER}
        aria-label={m.library_edit_status({ title: item.title })}
        aria-haspopup="menu"
        aria-expanded={open}
        {onkeydown}
        onclick={toggle}>
        {@render status(item)}
        <Icon
          name="chevron-down"
          class="text-dim h-3 w-3 transition-opacity group-hover:opacity-100 {open
            ? 'opacity-100'
            : 'opacity-0'}" />
      </button>
    {/snippet}
    {#snippet children({ close })}
      {#each edit!.statusOptions.filter((option) => !item.upcoming || option.value !== "COMPLETED") as option (option.value)}
        <button
          role="menuitem"
          class="menu-item"
          onclick={() => {
            close();
            if (option.value !== item.status.value)
              edit!.save(entry, { status: option.value });
          }}>
          <span class="text-accent grid h-4 w-4 place-items-center">
            {#if option.value === item.status.value}
              <Icon name="check" class="h-3.5 w-3.5" />
            {/if}
          </span>
          {option.label}
        </button>
      {/each}
    {/snippet}
  </Dropdown>
{/snippet}

{#snippet ownershipEdit(entry: T, item: LibraryItemView, value: string | null)}
  <Dropdown placement="bottom-start" role="menu" class="min-w-44">
    {#snippet trigger({ open, toggle, onkeydown })}
      <button
        type="button"
        class="{EDIT_TRIGGER} whitespace-nowrap"
        aria-label={m.library_edit_ownership({ title: item.title })}
        aria-haspopup="menu"
        aria-expanded={open}
        {onkeydown}
        onclick={toggle}>
        <span class={value ? "" : "text-dim"}>{value ?? "—"}</span>
        <Icon
          name="chevron-down"
          class="text-dim h-3 w-3 transition-opacity group-hover:opacity-100 {open
            ? 'opacity-100'
            : 'opacity-0'}" />
      </button>
    {/snippet}
    {#snippet children({ close })}
      <OwnershipMenuItems
        options={edit!.ownershipOptions}
        sourcesByStatus={edit!.ownershipSources}
        status={item.ownership}
        source={item.ownershipSource}
        onPick={(ownershipStatus, ownershipSource) => {
          close();
          if (
            ownershipStatus !== item.ownership ||
            ownershipSource !== item.ownershipSource
          )
            edit!.save(entry, { ownershipStatus, ownershipSource });
        }} />
    {/snippet}
  </Dropdown>
{/snippet}

<!-- The rating lives in the review, so both open the review form: "+ Noter"
     where there's none yet, a pen next to it where there is one — both only
     on row hover, the cell reading as plain text otherwise. -->
{#snippet ratingEdit(entry: T, item: LibraryItemView)}
  {#if item.upcoming}
    <span class="text-dim"
      >{item.rating === null ? "—" : `★ ${item.rating}`}</span>
  {:else if item.rating === null}
    <!-- Both labels share one grid cell, so the column keeps its width. -->
    <button
      type="button"
      class="hover:bg-accent/10 -mx-1.5 -my-0.5 inline-grid justify-items-end rounded-md px-1.5 py-0.5 whitespace-nowrap transition-[background-color,transform] active:scale-95"
      title={m.library_rating_add({ title: item.title })}
      aria-label={m.library_rating_add({ title: item.title })}
      onclick={() => edit!.review(entry)}>
      <span
        class="text-dim transition-opacity [grid-area:1/1] group-hover:opacity-0 group-has-[:focus-visible]:opacity-0">
        —
      </span>
      <span
        class="text-accent inline-flex items-center gap-1 font-sans text-xs font-semibold opacity-0 transition-opacity [grid-area:1/1] group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">
        <Icon name="plus" class="h-3.5 w-3.5" />
        {m.library_rating_short()}
      </span>
    </button>
  {:else}
    <button
      type="button"
      class="{EDIT_TRIGGER} whitespace-nowrap"
      title={m.library_rating_edit({ title: item.title })}
      aria-label={m.library_rating_edit({ title: item.title })}
      onclick={() => edit!.review(entry)}>
      <Icon
        name="edit"
        class="text-dim h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-has-[:focus-visible]:opacity-100" />
      ★ {item.rating}
    </button>
  {/if}
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
          {#each columns as column (column.key)}
            {@const active = column.sort === sort}
            <th
              scope="col"
              class="bg-surface-2 text-dim px-2.5 text-xs font-semibold whitespace-nowrap {compact
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
            class="group border-border [&:active:not(:has(button:active))]:bg-accent/10 has-[:focus-visible]:bg-surface-2 cursor-pointer border-t transition-[background-color,box-shadow] has-[:focus-visible]:shadow-[inset_3px_0_0_var(--color-accent)] {on
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
            {#each columns as column (column.key)}
              <td
                class="px-2.5 align-middle {compact
                  ? 'py-1.5'
                  : 'py-2'} {column.numeric
                  ? 'text-right font-mono tabular-nums'
                  : ''} {(column.kind === 'status' &&
                  justSaved(entry, 'status')) ||
                (column.kind === 'text' &&
                  column.ownership &&
                  justSaved(entry, 'ownership'))
                  ? 'cell-saved'
                  : ''}">
                {#if column.kind === "title"}
                  <div class="flex min-w-48 items-center gap-3">
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
                  {#if editing && !item.trackingLocked}
                    {@render statusEdit(entry, item)}
                    {#if justSaved(entry, "status")}{@render savedCheck()}{/if}
                  {:else}
                    {@render status(item)}
                  {/if}
                {:else if column.kind === "progress"}
                  {#if item.progress}
                    <div class="flex min-w-36 items-center gap-2">
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
                          {pausedLabel(item)}
                        </span>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-dim">—</span>
                  {/if}
                {:else if column.kind === "rating"}
                  {#if editing}
                    {@render ratingEdit(entry, item)}
                  {:else if item.rating !== null}
                    ★ {item.rating}
                  {:else}
                    <span class="text-dim">—</span>
                  {/if}
                {:else if column.kind === "text"}
                  {@const value = column.value(entry)}
                  {#if column.ownership && editing && !item.trackingLocked}
                    {@render ownershipEdit(entry, item, value)}
                    {#if justSaved(entry, "ownership")}{@render savedCheck()}{/if}
                  {:else}
                    <span
                      class="{column.truncate
                        ? 'block max-w-56 truncate'
                        : 'whitespace-nowrap'} {value ? '' : 'text-dim'}"
                      title={column.truncate
                        ? (value ?? undefined)
                        : undefined}>
                      {value ?? "—"}
                    </span>
                  {/if}
                {/if}
              </td>
            {/each}
            {#if !selection.active}
              <td class="px-2 {compact ? 'py-0.5' : 'py-1'}">
                {@render favorite(entry, item)}
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
          <div class="relative z-1">{@render favorite(entry, item)}</div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  /* Acknowledges an in-place save without a toast. */
  .cell-saved {
    animation: cell-saved 1.2s ease-out;
  }

  @keyframes cell-saved {
    from {
      background-color: color-mix(
        in srgb,
        var(--color-accent) 22%,
        transparent
      );
    }
  }

  .saved-check {
    animation: saved-check 1.6s forwards;
  }

  @keyframes saved-check {
    0%,
    60% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
