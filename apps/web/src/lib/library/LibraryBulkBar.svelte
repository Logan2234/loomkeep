<script lang="ts">
  // Floating bar of a library's selection mode (UX-04): the count, then one
  // menu per bulk action. A floating bar in the page's own theme, like the
  // search page's.
  import { getEditableLists } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import type { LibraryBulkActions } from "#lib/library/library-view.js";
  import { prefersReducedMotion } from "#lib/ui/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { BulkUpdateEntriesDto } from "@loomkeep/shared/contracts";
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";
  import Dropdown from "../ui/Dropdown.svelte";
  import Icon from "../ui/Icon.svelte";
  import OwnershipMenuItems from "./OwnershipMenuItems.svelte";
  import type { IconName } from "#lib/types/icon-name.js";

  let {
    count,
    bulk,
    busy,
    onUpdate,
    onRemove,
    onExit,
  }: {
    count: number;
    bulk: LibraryBulkActions;
    busy: boolean;
    onUpdate: (action: Omit<BulkUpdateEntriesDto, "ids" | "filters">) => void;
    onRemove: () => void;
    onExit: () => void;
  } = $props();

  const reduced = prefersReducedMotion();

  const listsQuery = createApiQuery(() => ({
    key: keys.lists.editable(),
    fetch: getEditableLists,
  }));
</script>

{#snippet action(icon: IconName, label: string, items: Snippet<[() => void]>)}
  <Dropdown placement="bottom-start" role="menu" class="min-w-48">
    {#snippet trigger({ open, toggle, onkeydown })}
      <button
        type="button"
        class="hover:bg-surface-2 inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-[background-color,transform] active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:h-auto sm:w-auto sm:px-3 sm:py-2"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        {onkeydown}
        onclick={toggle}>
        <Icon name={icon} class="h-4 w-4" />
        <span class="hidden sm:inline">{label}</span>
      </button>
    {/snippet}
    {#snippet children({ close })}
      {@render items(close)}
    {/snippet}
  </Dropdown>
{/snippet}

{#snippet statusItems(close: () => void)}
  {#each bulk.statusOptions as option (option.value)}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        onUpdate({ status: option.value });
      }}>
      {option.label}
    </button>
  {/each}
{/snippet}

{#snippet ownershipItems(close: () => void)}
  <OwnershipMenuItems
    options={bulk.ownershipOptions}
    sourcesByStatus={bulk.ownershipSources}
    onPick={(ownershipStatus, ownershipSource) => {
      close();
      onUpdate({ ownershipStatus, ownershipSource });
    }} />
{/snippet}

{#snippet favoriteItems(close: () => void)}
  {#each [true, false] as favorite (favorite)}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        onUpdate({ favorite });
      }}>
      <Icon
        name="star"
        class="h-4 w-4 {favorite ? 'fill-accent text-accent' : ''}" />
      {favorite ? m.common_favorite_add() : m.common_favorite_remove()}
    </button>
  {/each}
{/snippet}

{#snippet listItems(close: () => void)}
  {#each listsQuery.data ?? [] as list (list.id)}
    <button
      role="menuitem"
      class="menu-item"
      onclick={() => {
        close();
        onUpdate({ listId: list.id });
      }}>
      <Icon name="list" class="text-dim h-4 w-4" />
      <span class="truncate">{list.title}</span>
    </button>
  {:else}
    <p class="text-dim px-3 py-2 text-sm">
      {listsQuery.loading ? m.common_loading() : m.library_bulk_no_lists()}
    </p>
  {/each}
{/snippet}

<div
  class="pointer-events-none fixed inset-x-3 bottom-20 z-50 flex justify-center md:bottom-6">
  <div
    role="toolbar"
    aria-label={m.library_bulk_toolbar()}
    class="border-border bg-surface text-fg pointer-events-auto flex w-full items-center justify-between gap-0.5 rounded-2xl border p-1.5 shadow-2xl shadow-black/25 sm:w-auto sm:justify-start sm:pl-4"
    in:fly|global={{ y: 24, duration: reduced ? 0 : 260 }}
    out:fly|global={{ y: 24, duration: reduced ? 0 : 180 }}>
    <span aria-live="polite" class="sm:mr-2">
      <!-- Phones: the count alone, as a badge, so the whole bar fits one row. -->
      <span
        aria-hidden="true"
        class="bg-accent text-accent-fg ml-1 grid h-7 min-w-7 place-items-center rounded-full px-2 font-mono text-sm font-bold tabular-nums sm:hidden">
        {count}
      </span>
      <span
        class="sr-only font-mono text-sm font-bold tabular-nums sm:not-sr-only">
        {count === 1
          ? m.library_bulk_count_one({ count })
          : m.library_bulk_count_many({ count })}
      </span>
    </span>
    {@render action("flag", m.common_status(), statusItems)}
    {@render action("archive", m.ownership_title(), ownershipItems)}
    {@render action("star", m.common_favorite(), favoriteItems)}
    {@render action("list", m.add_to_list_button(), listItems)}
    <button
      type="button"
      class="text-danger hover:bg-surface-2 inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-[background-color,transform] active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:h-auto sm:w-auto sm:px-3 sm:py-2"
      aria-label={m.common_remove()}
      disabled={busy}
      onclick={onRemove}>
      <Icon name="trash" class="h-4 w-4" />
      <span class="hidden sm:inline">{m.common_remove()}</span>
    </button>
    <button
      type="button"
      class="text-dim hover:bg-surface-2 hover:text-fg grid h-10 w-10 place-items-center rounded-xl transition-[background-color,color,transform] active:scale-95 sm:ml-1 sm:h-9 sm:w-9"
      aria-label={m.library_bulk_exit()}
      onclick={onExit}>
      <Icon name="x" class="h-4 w-4" />
    </button>
  </div>
</div>
