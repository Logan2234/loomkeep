<script lang="ts">
  // The search page's selection bar (PRV-09): the count, then the two things
  // a handful of search results can share, adding them to the library or to
  // a list. Same dark floating bar as a library's selection mode.
  import { getEditableLists } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Dropdown from "#lib/components/Dropdown.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    addWorksToLibrary,
    addWorksToList,
    type BulkOutcome,
    type SearchSelection,
  } from "#lib/search/search-selection.svelte.js";
  import { toast } from "#lib/toast.svelte.js";
  import { fly } from "svelte/transition";

  let { selection }: { selection: SearchSelection } = $props();

  const reduced = prefersReducedMotion();

  const listsQuery = createApiQuery(() => ({
    key: keys.lists.editable(),
    fetch: getEditableLists,
  }));

  function report(outcome: BulkOutcome, done: string) {
    if (outcome.done === outcome.total) toast.success(done);
    else
      toast.error(
        m.search_selection_partial({
          done: outcome.done,
          total: outcome.total,
        }),
      );
  }

  // Every panel's "already added" flags: the selection may span domains.
  const shown = [
    keys.search.all(),
    keys.library.tracked(),
    keys.games.tracked(),
    keys.books.tracked(),
    keys.music.tracked(),
  ];

  const addMut = createApiMutation(() => ({
    mutate: () => addWorksToLibrary([...selection.works]),
    invalidates: shown,
    onSuccess: (outcome) => {
      report(
        outcome,
        outcome.done === 1
          ? m.search_selection_added_one()
          : m.search_selection_added_many({ count: outcome.done }),
      );
      selection.exit();
    },
    errorToast: true,
  }));

  const listMut = createApiMutation(() => ({
    mutate: (list: { id: string; title: string }) =>
      addWorksToList(list.id, [...selection.works]),
    invalidates: shown,
    onSuccess: (outcome, list) => {
      report(
        outcome,
        outcome.done === 1
          ? m.search_selection_listed_one({ list: list.title })
          : m.search_selection_listed_many({
              count: outcome.done,
              list: list.title,
            }),
      );
      selection.exit();
    },
    errorToast: true,
  }));

  const busy = $derived(addMut.loading || listMut.loading);
  const count = $derived(selection.count);
</script>

<div
  class="pointer-events-none fixed inset-x-3 bottom-20 z-50 flex justify-center md:bottom-6">
  <div
    role="toolbar"
    aria-label={m.search_selection_toolbar()}
    class="pointer-events-auto flex w-full items-center gap-1 rounded-2xl border border-[#2A2E38] bg-[#15171C] p-1.5 text-[#ECECEA] shadow-2xl shadow-black/40 sm:w-auto sm:pl-4"
    in:fly|global={{ y: 24, duration: reduced ? 0 : 260 }}
    out:fly|global={{ y: 24, duration: reduced ? 0 : 180 }}>
    <span aria-live="polite" class="mr-auto sm:mr-2">
      <!-- Phones: the count alone, as a badge, so the bar fits one row. -->
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
    <button
      type="button"
      class="bg-accent text-accent-fg inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-40"
      disabled={busy || count === 0}
      onclick={() => addMut.mutate()}>
      <Icon name="plus" class="h-4 w-4" />
      {m.common_add()}
    </button>
    <Dropdown placement="bottom-end" role="menu" class="min-w-48">
      {#snippet trigger({ open, toggle, onkeydown })}
        <button
          type="button"
          class="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-[background-color,transform] hover:bg-white/10 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={busy || count === 0}
          {onkeydown}
          onclick={toggle}>
          <Icon name="list" class="h-4 w-4" />
          {m.search_selection_list()}
        </button>
      {/snippet}
      {#snippet children({ close })}
        {#each listsQuery.data ?? [] as list (list.id)}
          <button
            role="menuitem"
            class="menu-item"
            onclick={() => {
              close();
              listMut.mutate(list);
            }}>
            <Icon name="list" class="text-dim h-4 w-4" />
            <span class="truncate">{list.title}</span>
          </button>
        {:else}
          <p class="text-dim px-3 py-2 text-sm">
            {listsQuery.loading
              ? m.common_loading()
              : m.library_bulk_no_lists()}
          </p>
        {/each}
      {/snippet}
    </Dropdown>
    <button
      type="button"
      class="grid h-10 w-10 place-items-center rounded-xl text-[#9AA0AE] transition-[background-color,color,transform] hover:bg-white/10 hover:text-[#ECECEA] active:scale-95 sm:ml-1 sm:h-9 sm:w-9"
      aria-label={m.library_bulk_exit()}
      onclick={() => selection.exit()}>
      <Icon name="x" class="h-4 w-4" />
    </button>
  </div>
</div>
