<script lang="ts">
  import { OWNERSHIP_SOURCE_MAX_LENGTH } from "@loomkeep/shared";

  // The items of an ownership menu, for a Dropdown with role="menu": one
  // entry per way of owning a work, and a submenu for those that come with
  // presets (Streaming › Netflix, Prime Video…, "Autre…" for a free value).
  import { m } from "$lib/paraglide/messages.js";
  import DropdownSubmenu from "./DropdownSubmenu.svelte";
  import Icon from "./Icon.svelte";

  let {
    options,
    sourcesByStatus,
    status = null,
    source = null,
    onPick,
  }: {
    options: { value: string; label: string }[];
    sourcesByStatus: Record<string, string[]>;
    /** The current value, checked in the menu; null when there's none (bulk). */
    status?: string | null;
    source?: string | null;
    onPick: (status: string, source: string | null) => void;
  } = $props();

  // The status whose "Autre…" turned into a text field.
  let customFor = $state<string | null>(null);

  function commitCustom(value: string, input: HTMLInputElement) {
    const trimmed = input.value.trim();
    onPick(value, trimmed === "" ? null : trimmed);
  }
</script>

{#snippet check(on: boolean)}
  <span class="text-accent grid h-4 w-4 place-items-center">
    {#if on}<Icon name="check" class="h-3.5 w-3.5" />{/if}
  </span>
{/snippet}

{#each options as option (option.value)}
  {@const presets = sourcesByStatus[option.value]}
  {@const current = status === option.value}
  {#if presets}
    {@const custom = current && source !== null && !presets.includes(source)}
    <DropdownSubmenu label={option.label} checked={current}>
      <button
        role="menuitem"
        class="menu-item"
        onclick={() => onPick(option.value, null)}>
        {@render check(current && source === null)}
        {m.ownership_unspecified()}
      </button>
      <div class="border-border my-1 border-t"></div>
      {#each presets as preset (preset)}
        <button
          role="menuitem"
          class="menu-item"
          onclick={() => onPick(option.value, preset)}>
          {@render check(current && source === preset)}
          {preset}
        </button>
      {/each}
      {#if customFor === option.value}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          class="input mx-2 my-1 w-auto py-1.5 text-sm"
          maxlength={OWNERSHIP_SOURCE_MAX_LENGTH}
          placeholder={m.ownership_source_placeholder()}
          value={custom ? source : ""}
          autofocus
          onkeydown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitCustom(option.value, e.currentTarget);
            }
          }} />
      {:else}
        <button
          role="menuitem"
          class="menu-item"
          onclick={(e) => {
            // Stays open: the text field replaces this item.
            e.stopPropagation();
            customFor = option.value;
          }}>
          {@render check(custom)}
          {custom ? source : m.ownership_other()}
        </button>
      {/if}
    </DropdownSubmenu>
  {:else}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => onPick(option.value, null)}>
      {@render check(current)}
      {option.label}
    </button>
  {/if}
{/each}
