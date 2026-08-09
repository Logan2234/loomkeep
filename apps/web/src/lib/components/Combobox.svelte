<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";

  // A styled dropdown used across the library filter bars. Works in two modes:
  //  - multiselect: several values at once (status, media type). Trigger reads
  //    "Label : tous" when empty, "Label : N" otherwise.
  //  - single-select (multiselect=false): one value (sort). Trigger shows the
  //    chosen option's label.
  // Selection is always modelled as a string[]; single-select emits a 1-element
  // array. The caller owns the state and reacts through onChange.
  type Option = { label: string; value: string };

  let {
    label,
    options,
    values = [],
    multiselect = false,
    searchable = false,
    searchPlaceholder = "Rechercher…",
    disabledValues = [],
    disabledHint,
    onChange,
  }: {
    label: string;
    options: Option[];
    values?: string[];
    multiselect?: boolean;
    /** Adds a text filter at the top of the panel. Single-select only. */
    searchable?: boolean;
    searchPlaceholder?: string;
    /** Options rendered unselectable (e.g. capped by another setting). */
    disabledValues?: string[];
    /** Tooltip shown on a disabled option. */
    disabledHint?: string;
    onChange: (values: string[]) => void;
  } = $props();

  let open = $state(false);
  let query = $state("");
  let searchInput: HTMLInputElement | undefined;
  let triggerEl: HTMLButtonElement | undefined;
  // Positioned `fixed` (viewport coords) rather than `absolute`, so the panel
  // never gets clipped by an ancestor `.card`'s `overflow-hidden`.
  let panelPos = $state({ top: 0, left: 0 });

  const selectedOption = $derived(options.find((o) => o.value === values[0]));
  const triggerText = $derived(
    multiselect
      ? `${label} : ${values.length === 0 ? "Tous" : values.length}`
      : (selectedOption?.label ?? label),
  );
  const visibleOptions = $derived(
    searchable && query.trim()
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : options,
  );

  function choose(value: string) {
    if (multiselect) {
      onChange(
        values.includes(value)
          ? values.filter((v) => v !== value)
          : [...values, value],
      );
    } else {
      onChange([value]);
      open = false;
    }
  }

  function toggleOpen() {
    open = !open;
    if (open) {
      query = "";
      if (triggerEl) {
        const rect = triggerEl.getBoundingClientRect();
        panelPos = { top: rect.bottom + 4, left: rect.left };
      }
      if (searchable) queueMicrotask(() => searchInput?.focus());
    }
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === "Escape" && (open = false)}
  onresize={() => (open = false)}
  onscroll={() => (open = false)} />

<div class="relative">
  <button
    bind:this={triggerEl}
    type="button"
    class="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors {multiselect &&
    values.length > 0
      ? 'border-accent bg-accent text-accent-fg hover:text-accent-fg'
      : 'border-border text-dim hover:text-fg'}"
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={toggleOpen}>
    {triggerText}
    <Icon
      name="chevron-right"
      class="h-3.5 w-3.5 transition-transform {open
        ? 'rotate-270'
        : 'rotate-90'}" />
  </button>

  {#if open}
    <!-- Click-away backdrop (fixed so it covers the viewport). -->
    <button
      class="fixed inset-0 z-30 cursor-default"
      aria-label={m.common_close()}
      onclick={() => (open = false)}></button>
    <div
      role="listbox"
      style="top: {panelPos.top}px; left: {panelPos.left}px;"
      class="border-border bg-surface fixed z-40 min-w-48 overflow-hidden rounded-lg border py-1 shadow-lg">
      {#if searchable}
        <div class="border-border border-b p-1.5">
          <input
            bind:this={searchInput}
            bind:value={query}
            type="text"
            placeholder={searchPlaceholder}
            class="border-border bg-surface-2 w-full rounded-md border px-2 py-1 text-sm" />
        </div>
      {/if}
      {#each visibleOptions as o (o.value)}
        {@const on = values.includes(o.value)}
        {@const dis = disabledValues.includes(o.value)}
        <button
          type="button"
          role="option"
          aria-selected={on}
          disabled={dis}
          title={dis ? disabledHint : undefined}
          class="hover:bg-surface-2 flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-40"
          onclick={() => choose(o.value)}>
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
        <p class="text-dim px-3 py-2 text-sm">Aucun résultat.</p>
      {/if}
    </div>
  {/if}
</div>
