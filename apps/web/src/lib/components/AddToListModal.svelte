<script lang="ts">
  import {
    addListItem,
    getEditableLists,
    getListMembership,
    removeListItem,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import type { ListItemTargetType, MyListDto } from "@loomkeep/shared";
  import { m } from "$lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";
  import ListFormModal from "./ListFormModal.svelte";
  import Modal from "./Modal.svelte";

  // Checklist of "Mes listes" to toggle membership for one work — same
  // props shape as ReviewsSection/CommentThread (targetType/targetId).
  let {
    targetType,
    targetId,
    onClose,
  }: {
    targetType: ListItemTargetType;
    targetId: string;
    onClose: () => void;
  } = $props();

  let creating = $state(false);

  const membershipKey = $derived(keys.lists.membership(targetType, targetId));

  const listsQuery = createApiQuery(() => ({
    key: keys.lists.editable(),
    fetch: getEditableLists,
  }));
  const membershipQuery = createApiQuery(() => ({
    key: membershipKey,
    fetch: () => getListMembership(targetType, targetId),
  }));

  const lists = $derived(listsQuery.data ?? []);
  const itemIdByList = $derived(membershipQuery.data ?? {});
  const loading = $derived(listsQuery.loading || membershipQuery.loading);
  const error = $derived(listsQuery.error ?? membershipQuery.error);

  // Invalidating both keys is what keeps the checkbox and the work count
  // honest — the previous version patched them locally and swallowed every
  // failure, so an offline toggle looked like a no-op.
  const toggleMut = createApiMutation(() => ({
    mutate: async ({ list }: { list: MyListDto }) => {
      const existingItemId = itemIdByList[list.id];

      if (existingItemId) {
        await removeListItem(list.id, existingItemId);
        return;
      }

      await addListItem(list.id, targetType, targetId);
    },
    invalidates: [keys.lists.editable(), membershipKey],
    errorToast: true,
  }));

  const busyId = $derived(
    toggleMut.loading ? (toggleMut.variables?.list.id ?? null) : null,
  );

  function toggle(list: MyListDto) {
    toggleMut.mutate({ list });
  }

  function handleCreated() {
    creating = false;
  }
</script>

<Modal title={m.add_to_list_button()} onclose={onClose}>
  {#if loading}
    <p class="text-dim text-sm">{m.common_loading()}</p>
  {:else if error}
    <p class="text-danger text-sm">{error}</p>
  {:else if lists.length === 0}
    <p class="text-dim text-sm">{m.lists_none_yet()}</p>
  {:else}
    <ul class="flex flex-col gap-1">
      {#each lists as list (list.id)}
        <li>
          <label
            class="hover:bg-surface-2 flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left {busyId ===
            list.id
              ? 'pointer-events-none opacity-50'
              : ''}">
            <input
              type="checkbox"
              name="listIds"
              value={list.id}
              class="accent-accent h-4 w-4 shrink-0"
              checked={!!itemIdByList[list.id]}
              onchange={() => toggle(list)} />
            <span class="min-w-0 flex-1 truncate font-semibold"
              >{list.title}</span>
            <span class="text-dim text-xs"
              >{list.itemCount === 1
                ? m.lists_work_count_one({ count: list.itemCount })
                : m.lists_work_count_many({ count: list.itemCount })}</span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}

  <button
    type="button"
    class="btn btn-ghost mt-3 w-full"
    onclick={() => (creating = true)}>
    <Icon name="plus" class="h-4 w-4" />
    {m.lists_create_button()}
  </button>
</Modal>

{#if creating}
  <ListFormModal onClose={() => (creating = false)} onSaved={handleCreated} />
{/if}
