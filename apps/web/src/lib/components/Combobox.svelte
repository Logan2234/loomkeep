<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import { tick } from "svelte";
  import Dropdown from "./Dropdown.svelte";
  import Icon from "./Icon.svelte";
  import {
    getEnabledOptionIndex,
    reconcileActiveOptionValue,
    type ListNavigationCommand,
  } from "./list-navigation";

  type Option = { label: string; value: string; disabled?: boolean };

  let {
    label,
    options,
    values = [],
    multiselect = false,
    searchable = false,
    searchPlaceholder,
    selectedLabel,
    loading = false,
    hasMore = false,
    name,
    disabled = false,
    onSearch,
    onLoadMore,
    onChange,
  }: {
    label: string;
    options: Option[];
    values?: string[];
    multiselect?: boolean;
    /** Adds a text filter at the top of the panel. */
    searchable?: boolean;
    searchPlaceholder?: string;
    /** Label retained when a server-selected value is outside the current page. */
    selectedLabel?: string;
    loading?: boolean;
    hasMore?: boolean;
    name?: string;
    disabled?: boolean;
    /** Enables server-side filtering instead of filtering `options` locally. */
    onSearch?: (query: string) => void;
    onLoadMore?: () => void;
    onChange: (values: string[]) => void;
  } = $props();

  let query = $state("");
  let searchInput: HTMLInputElement | undefined = $state();
  const componentId = $props.id();
  const listboxId = `combobox-${componentId}-listbox`;

  const selectedOption = $derived(options.find((o) => o.value === values[0]));
  const resolvedSearchPlaceholder = $derived(
    searchPlaceholder ?? m.common_search_placeholder(),
  );
  const triggerText = $derived(
    multiselect
      ? m.common_selection_summary({
          label,
          selection:
            values.length === 0 ? m.common_all() : String(values.length),
        })
      : (selectedOption?.label ?? selectedLabel ?? label),
  );
  const visibleOptions = $derived(
    searchable && !onSearch && query.trim()
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : options,
  );
  let activeValue = $derived(
    reconcileActiveOptionValue(visibleOptions, null, values),
  );
  const accessibleLabel = $derived(
    multiselect
      ? triggerText
      : selectedOption || selectedLabel
        ? m.common_selection_summary({
            label,
            selection: selectedOption?.label ?? selectedLabel ?? "",
          })
        : label,
  );
  const activeIndex = $derived(
    visibleOptions.findIndex(
      (option) => option.value === activeValue && !option.disabled,
    ),
  );
  const activeOptionId = $derived(
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined,
  );

  function choose(option: Option, close: () => void) {
    if (option.disabled) return;
    if (multiselect) {
      onChange(
        values.includes(option.value)
          ? values.filter((value) => value !== option.value)
          : [...values, option.value],
      );
    } else {
      onChange([option.value]);
      close();
    }
  }

  function resetActive(command: "first" | "last" = "first") {
    if (command === "first") {
      activeValue = reconcileActiveOptionValue(visibleOptions, null, values);
      return;
    }

    const index = getEnabledOptionIndex(visibleOptions, -1, command);
    activeValue = index >= 0 ? visibleOptions[index].value : null;
  }

  function moveActive(command: ListNavigationCommand) {
    const index = getEnabledOptionIndex(visibleOptions, activeIndex, command);
    activeValue = index >= 0 ? visibleOptions[index].value : null;
  }

  function focusSearchInput() {
    if (searchable) void tick().then(() => searchInput?.focus());
  }

  function openPanel(
    e: Event,
    toggle: (event: Event) => void,
    command: "first" | "last" = "first",
  ) {
    query = "";
    onSearch?.("");
    resetActive(command);
    toggle(e);
    focusSearchInput();
  }

  function chooseActive(close: () => void) {
    const option = visibleOptions[activeIndex];
    if (option) choose(option, close);
  }

  function onTriggerKeydown(
    e: KeyboardEvent,
    open: boolean,
    toggle: (event: Event) => void,
    close: () => void,
  ) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
      return;
    }

    const command =
      e.key === "ArrowDown"
        ? "next"
        : e.key === "ArrowUp"
          ? "previous"
          : e.key === "Home"
            ? "first"
            : e.key === "End"
              ? "last"
              : undefined;
    if (command) {
      e.preventDefault();
      if (!open) {
        openPanel(
          e,
          toggle,
          command === "previous" || command === "last" ? "last" : "first",
        );
      } else {
        moveActive(command);
      }
      return;
    }

    if (open && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      chooseActive(close);
    }
  }

  function onSearchKeydown(e: KeyboardEvent, close: () => void) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }

    const command =
      e.key === "ArrowDown"
        ? "next"
        : e.key === "ArrowUp"
          ? "previous"
          : e.key === "Home"
            ? "first"
            : e.key === "End"
              ? "last"
              : undefined;
    if (command) {
      e.preventDefault();
      moveActive(command);
    } else if (e.key === "Enter") {
      e.preventDefault();
      chooseActive(close);
    }
  }
</script>

{#if name}
  {#each values as value (`${name}:${value}`)}
    <input type="hidden" {name} {value} {disabled} />
  {/each}
{/if}

<Dropdown role="presentation" class="max-w-[calc(100vw-1rem)] min-w-48">
  {#snippet trigger({ open, toggle, close })}
    <button
      type="button"
      role={searchable ? undefined : "combobox"}
      class="inline-flex max-w-[calc(100vw-1rem)] items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 {multiselect &&
      values.length > 0
        ? 'border-accent bg-accent text-accent-fg hover:text-accent-fg'
        : 'border-border text-dim hover:text-fg'}"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      aria-activedescendant={!searchable && open ? activeOptionId : undefined}
      aria-label={accessibleLabel}
      data-escape-consumer={open ? "" : undefined}
      {disabled}
      onkeydown={(e) => onTriggerKeydown(e, open, toggle, close)}
      onclick={(e) => {
        if (!open) {
          openPanel(e, toggle);
        } else {
          toggle(e);
        }
      }}>
      <span class="truncate">{triggerText}</span>
      <Icon
        name="chevron-right"
        class="h-3.5 w-3.5 transition-transform {open
          ? 'rotate-270'
          : 'rotate-90'}" />
    </button>
  {/snippet}
  {#snippet children({ close })}
    {#if searchable}
      <div class="border-border shrink-0 border-b p-1.5">
        <input
          bind:this={searchInput}
          bind:value={query}
          type="text"
          role="combobox"
          aria-label={resolvedSearchPlaceholder}
          aria-expanded="true"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          enterkeyhint="search"
          placeholder={resolvedSearchPlaceholder}
          oninput={(event) => {
            resetActive();
            onSearch?.(event.currentTarget.value);
          }}
          onkeydown={(e) => onSearchKeydown(e, close)}
          class="border-border bg-surface-2 w-full rounded-md border px-2 py-1 text-sm" />
      </div>
    {/if}
    <div
      id={listboxId}
      role="listbox"
      aria-label={label}
      aria-multiselectable={multiselect ? "true" : undefined}
      class="overflow-y-auto">
      {#each visibleOptions as o, index (o.value)}
        {@const on = values.includes(o.value)}
        <button
          id={`${listboxId}-option-${index}`}
          type="button"
          role="option"
          aria-selected={on}
          aria-disabled={o.disabled ? "true" : undefined}
          tabindex="-1"
          disabled={o.disabled}
          class="hover:bg-surface-2 flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-40 {index ===
          activeIndex
            ? 'bg-surface-2'
            : ''}"
          onmouseenter={() => !o.disabled && (activeValue = o.value)}
          onclick={() => choose(o, close)}>
          {#if multiselect}
            <span
              class="grid h-4 w-4 shrink-0 place-items-center rounded border {on
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-border'}">
              {#if on}<Icon name="check" class="h-3 w-3" />{/if}
            </span>
          {:else}
            <span class="text-accent grid h-4 w-4 shrink-0 place-items-center">
              {#if on}<Icon name="check" class="h-3.5 w-3.5" />{/if}
            </span>
          {/if}
          <span
            class="min-w-0 wrap-anywhere whitespace-normal {on && !multiselect
              ? 'font-semibold'
              : ''}">
            {o.label}
          </span>
        </button>
      {/each}
      {#if searchable && visibleOptions.length === 0}
        <p role="status" class="text-dim px-3 py-2 text-sm">
          {loading ? m.common_loading() : m.common_no_results()}
        </p>
      {/if}
    </div>
    {#if hasMore && onLoadMore}
      <button
        type="button"
        class="text-accent hover:bg-surface-2 w-full px-3 py-2 text-left text-sm font-semibold disabled:opacity-50"
        disabled={loading}
        onclick={onLoadMore}>
        {loading ? m.common_loading() : m.common_load_more()}
      </button>
    {/if}
  {/snippet}
</Dropdown>
