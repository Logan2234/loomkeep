<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import Dropdown from "./Dropdown.svelte";
  import Icon from "./Icon.svelte";

  type Option = { label: string; value: string };

  let {
    label,
    options,
    values = [],
    multiselect = false,
    searchable = false,
    searchPlaceholder = "Rechercher…",
    name,
    disabled = false,
    onChange,
  }: {
    label: string;
    options: Option[];
    values?: string[];
    multiselect?: boolean;
    /** Adds a text filter at the top of the panel. Single-select only. */
    searchable?: boolean;
    searchPlaceholder?: string;
    name?: string;
    disabled?: boolean;
    onChange: (values: string[]) => void;
  } = $props();

  let query = $state("");
  let searchInput: HTMLInputElement | undefined = $state();

  const selectedOption = $derived(options.find((o) => o.value === values[0]));
  const triggerText = $derived(
    multiselect
      ? `${label} : ${values.length === 0 ? m.common_all() : values.length}`
      : (selectedOption?.label ?? label),
  );
  const visibleOptions = $derived(
    searchable && query.trim()
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : options,
  );
  const accessibleLabel = $derived(
    multiselect
      ? triggerText
      : selectedOption
        ? `${label}: ${selectedOption.label}`
        : label,
  );

  function choose(value: string, close: () => void) {
    if (multiselect) {
      onChange(
        values.includes(value)
          ? values.filter((v) => v !== value)
          : [...values, value],
      );
    } else {
      onChange([value]);
      close();
    }
  }
</script>

{#if name}
  {#each values as value (`${name}:${value}`)}
    <input type="hidden" {name} {value} {disabled} />
  {/each}
{/if}

<Dropdown role="listbox" class="min-w-48">
  {#snippet trigger({ open, toggle })}
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors {multiselect &&
      values.length > 0
        ? 'border-accent bg-accent text-accent-fg hover:text-accent-fg'
        : 'border-border text-dim hover:text-fg'}"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={accessibleLabel}
      {disabled}
      onclick={(e) => {
        if (!open) {
          query = "";
          if (searchable) queueMicrotask(() => searchInput?.focus());
        }
        toggle(e);
      }}>
      {triggerText}
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
          aria-label={searchPlaceholder}
          enterkeyhint="search"
          placeholder={searchPlaceholder}
          class="border-border bg-surface-2 w-full rounded-md border px-2 py-1 text-sm" />
      </div>
    {/if}
    <div class="overflow-y-auto">
      {#each visibleOptions as o (o.value)}
        {@const on = values.includes(o.value)}
        <button
          type="button"
          role="option"
          aria-selected={on}
          class="hover:bg-surface-2 flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-40"
          onclick={() => choose(o.value, close)}>
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
          <span class="{on && !multiselect ? 'font-semibold' : ''} truncate">
            {o.label}
          </span>
        </button>
      {/each}
      {#if searchable && visibleOptions.length === 0}
        <p class="text-dim px-3 py-2 text-sm">{m.common_no_results()}.</p>
      {/if}
    </div>
  {/snippet}
</Dropdown>
