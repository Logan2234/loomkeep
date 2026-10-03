<script lang="ts">
  import {
    addListItem,
    createList,
    getEditableLists,
    getListMembership,
    removeListItem,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    ListItemTargetType,
    ListVisibility,
    MyListDto,
  } from "@loomkeep/shared";
  import { flip } from "svelte/animate";
  import { slide } from "svelte/transition";
  import Icon from "./Icon.svelte";
  import ListCoverGrid from "./ListCoverGrid.svelte";
  import Modal from "./Modal.svelte";
  import Switch from "./Switch.svelte";

  // Toggles one work in and out of the lists the viewer can edit — same props
  // shape as ReviewsSection/CommentThread (targetType/targetId). The search
  // doubles as the way to start a new list.
  let {
    targetType,
    targetId,
    onClose,
  }: {
    targetType: ListItemTargetType;
    targetId: string;
    onClose: () => void;
  } = $props();

  const reduced = prefersReducedMotion();

  const VISIBILITY_LABEL: Record<ListVisibility, string> = {
    PRIVATE: m.common_private(),
    FRIENDS: m.common_friends(),
    PUBLIC: m.common_public(),
  };

  let query = $state("");

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

  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  // The lists already holding the work come first: the picker doubles as a
  // summary of where it sits.
  const byMembership = (a: MyListDto, b: MyListDto) =>
    Number(!!itemIdByList[b.id]) - Number(!!itemIdByList[a.id]);

  const matching = $derived(
    lists.filter((list) => normalize(list.title).includes(normalize(query))),
  );
  const mine = $derived(
    matching.filter((list) => list.role === "OWNER").sort(byMembership),
  );
  const shared = $derived(
    matching.filter((list) => list.role === "EDITOR").sort(byMembership),
  );
  const newTitle = $derived(query.trim());
  const canCreate = $derived(
    newTitle.length > 0 &&
      !lists.some((list) => normalize(list.title) === normalize(newTitle)),
  );

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

  const createMut = createApiMutation(() => ({
    mutate: async (title: string) => {
      const list = await createList({
        title,
        kind: "COLLECTION",
        visibility: "PRIVATE",
      });
      await addListItem(list.id, targetType, targetId);
    },
    invalidates: [keys.lists.editable(), membershipKey],
    errorToast: true,
    onSuccess: () => (query = ""),
  }));

  function create() {
    if (canCreate) createMut.mutate(newTitle);
  }

  function workCount(count: number) {
    return count === 1
      ? m.lists_work_count_one({ count })
      : m.lists_work_count_many({ count });
  }
</script>

{#snippet row(list: MyListDto)}
  {@const checked = !!itemIdByList[list.id]}
  <div
    class="flex items-center gap-3 rounded-lg px-2 py-2 transition-opacity {busyId ===
    list.id
      ? 'opacity-50'
      : ''}">
    <span class="w-9 shrink-0 overflow-hidden rounded-md">
      <ListCoverGrid images={list.previewImageUrls} title={list.title} />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate font-semibold">{list.title}</span>
      <span class="timecode block truncate text-xs">
        {#if list.role === "EDITOR"}
          {m.list_owned_by_editor({ name: list.author.displayName })} ·
        {/if}
        {workCount(list.itemCount)} · {VISIBILITY_LABEL[list.visibility]}
      </span>
    </span>
    <Switch
      {checked}
      label={list.title}
      disabled={busyId === list.id}
      onChange={() => toggleMut.mutate({ list })} />
  </div>
{/snippet}

{#snippet group(title: string, items: MyListDto[])}
  <section>
    <h3 class="timecode text-micro px-2 pt-3 pb-1 tracking-wide uppercase">
      {title}
    </h3>
    {#each items as list (list.id)}
      <div animate:flip={{ duration: reduced ? 0 : 240 }}>
        {@render row(list)}
      </div>
    {/each}
  </section>
{/snippet}

<Modal title={m.add_to_list_button()} onclose={onClose}>
  <div class="flex flex-col gap-2">
    <div class="relative">
      <Icon
        name="search"
        class="text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <input
        type="search"
        class="input pl-9"
        maxlength={100}
        enterkeyhint="done"
        placeholder={m.add_to_list_search()}
        aria-label={m.add_to_list_search()}
        bind:value={query}
        onkeydown={(event) => event.key === "Enter" && create()} />
    </div>

    {#if loading}
      <div class="space-y-2 pt-2">
        {#each Array(3) as _, i (i)}
          <div class="skeleton h-12 w-full rounded-lg"></div>
        {/each}
      </div>
    {:else if error}
      <p class="text-danger text-sm">{error}</p>
    {:else}
      {#if canCreate}
        <button
          type="button"
          class="bg-accent/8 hover:bg-accent/14 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left font-semibold transition-colors"
          disabled={createMut.loading}
          transition:slide={{ duration: reduced ? 0 : 180 }}
          onclick={create}>
          <span
            class="bg-accent text-accent-fg grid h-9 w-9 shrink-0 place-items-center rounded-md">
            <Icon name="plus" class="h-4 w-4" />
          </span>
          <span class="min-w-0 truncate">
            {m.add_to_list_create({ title: newTitle })}
          </span>
        </button>
      {/if}

      {#if mine.length > 0}
        {@render group(m.lists_title(), mine)}
      {/if}
      {#if shared.length > 0}
        {@render group(m.add_to_list_shared(), shared)}
      {/if}

      {#if lists.length === 0 && !canCreate}
        <p class="text-dim px-2 py-3 text-sm">{m.add_to_list_empty()}</p>
      {/if}
    {/if}
  </div>
</Modal>
