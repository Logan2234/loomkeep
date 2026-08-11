<script lang="ts">
  import {
    addListItem,
    getEditableLists,
    getListMembership,
    removeListItem,
  } from "$lib/api/client";
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

  let lists = $state<MyListDto[]>([]);
  let itemIdByList = $state<Record<string, string>>({});
  let loading = $state(true);
  let busyId = $state<string | null>(null);
  let creating = $state(false);

  function load() {
    loading = true;
    Promise.all([getEditableLists(), getListMembership(targetType, targetId)])
      .then(([r, membership]) => {
        lists = r;
        itemIdByList = membership;
      })
      .finally(() => (loading = false));
  }

  $effect(load);

  async function toggle(list: MyListDto) {
    if (busyId) return;
    busyId = list.id;
    try {
      const existingItemId = itemIdByList[list.id];
      if (existingItemId) {
        await removeListItem(list.id, existingItemId);
        itemIdByList = { ...itemIdByList, [list.id]: "" };
        lists = lists.map((l) =>
          l.id === list.id ? { ...l, itemCount: l.itemCount - 1 } : l,
        );
      } else {
        const item = await addListItem(list.id, targetType, targetId);
        itemIdByList = { ...itemIdByList, [list.id]: item.id };
        lists = lists.map((l) =>
          l.id === list.id ? { ...l, itemCount: l.itemCount + 1 } : l,
        );
      }
    } catch {
      // Already in the list (race/stale state) — ignore, next load reconciles.
    } finally {
      busyId = null;
    }
  }

  function handleCreated() {
    creating = false;
    load();
  }
</script>

<Modal title="Ajouter à une liste" onclose={onClose}>
  {#if loading}
    <p class="text-dim text-sm">{m.common_loading()}</p>
  {:else if lists.length === 0}
    <p class="text-dim text-sm">Tu n'as pas encore de liste.</p>
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
              class="accent-accent h-4 w-4 shrink-0"
              checked={!!itemIdByList[list.id]}
              onchange={() => toggle(list)} />
            <span class="min-w-0 flex-1 truncate font-semibold"
              >{list.title}</span>
            <span class="text-dim text-xs"
              >{list.itemCount} {list.itemCount > 1 ? "œuvres" : "œuvre"}</span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}

  <button
    type="button"
    class="btn btn-ghost mt-3 w-full"
    onclick={() => (creating = true)}>
    <Icon name="plus" class="h-4 w-4" /> Créer une liste
  </button>
</Modal>

{#if creating}
  <ListFormModal onClose={() => (creating = false)} onSaved={handleCreated} />
{/if}
