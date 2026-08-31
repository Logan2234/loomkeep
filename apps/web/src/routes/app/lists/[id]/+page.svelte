<script lang="ts">
  import { page } from "$app/state";
  import { longpress } from "$lib/actions/longpress";
  import {
    ApiError,
    getList,
    getMyList,
    removeListItem,
    removeListMember,
    reorderListItems,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import FocusOverlay from "$lib/components/FocusOverlay.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ListFormModal from "$lib/components/ListFormModal.svelte";
  import ListMembersModal from "$lib/components/ListMembersModal.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import type { ListDto, ListItemDto } from "@loomkeep/shared";
  import { dndzone } from "svelte-dnd-action";
  import { useQueryClient } from "@tanstack/svelte-query";

  const KIND_LABEL: Record<string, string> = {
    RANKED: m.lists_kind_ranked(),
    COLLECTION: m.lists_kind_collection(),
  };
  const VISIBILITY_LABEL: Record<string, string> = {
    PRIVATE: m.common_private(),
    FRIENDS: m.common_friends(),
    PUBLIC: m.common_public(),
  };

  const id = $derived(page.params.id ?? "");
  const detailKey = $derived(keys.lists.detail(id));
  const queryClient = useQueryClient();

  let editing = $state(false);
  let managingMembers = $state(false);
  let conflictNotice = $state(false);
  let focusedItemId = $state<string | null>(null);
  let confirmRemoveId = $state<string | null>(null);

  // Set only when getMyList's 403/404 fallback (getList, for a shared/public
  // list the viewer doesn't own) also fails — the query's own resolved error
  // otherwise covers every other failure.
  let notFoundAfterFallback = $state(false);

  const listQuery = createApiQuery(() => ({
    key: detailKey,
    fetch: async () => {
      try {
        return await getMyList(id);
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.status === 403 || err.status === 404)
        ) {
          try {
            return await getList(id);
          } catch {
            notFoundAfterFallback = true;
            throw err;
          }
        }
        throw err;
      }
    },
    enabled: !!id,
  }));
  $effect(() => {
    if (listQuery.data) notFoundAfterFallback = false;
  });
  const list = $derived(listQuery.data);
  const loading = $derived(listQuery.loading);
  const error = $derived(
    notFoundAfterFallback ? m.list_unavailable() : listQuery.error,
  );

  const role = $derived(list?.viewerRole ?? "VIEWER");
  const canEditList = $derived(role === "OWNER" || role === "EDITOR");
  const isOwner = $derived(role === "OWNER");
  let removingId = $state<string | null>(null);

  // Local, reorderable copy of the items — svelte-dnd-action mutates this
  // directly during a drag; resets to the query's own items whenever those
  // change underneath (a refetch, a reorder-conflict reload, …).
  let dragItems: ListItemDto[] = $derived(list?.items ?? []);

  const confirmRemoveItem = $derived(
    dragItems.find((i) => i.id === confirmRemoveId) ?? null,
  );

  function patchList(patch: Partial<NonNullable<typeof list>>) {
    queryClient.setQueryData(detailKey, (old: typeof list) =>
      old ? { ...old, ...patch } : old,
    );
  }

  function handleSaved(updated: ListDto) {
    patchList(updated);
  }

  function handleDeleted() {
    window.location.href = "/app/lists";
  }

  const leaveMut = createApiMutation(() => ({
    mutate: () => removeListMember(list!.id, auth.user!.id),
    onSuccess: () => (window.location.href = "/app/lists"),
  }));

  function leaveList() {
    if (!list || leaveMut.loading || !auth.user) return;
    leaveMut.mutate();
  }

  async function removeItem(itemId: string) {
    if (!list || removingId) return;
    removingId = itemId;
    try {
      await removeListItem(list.id, itemId);
      const items = list.items.filter((i) => i.id !== itemId);
      patchList({ items });
    } finally {
      removingId = null;
    }
  }

  async function confirmRemove() {
    if (!confirmRemoveId) return;
    const itemId = confirmRemoveId;
    confirmRemoveId = null;
    focusedItemId = null;
    await removeItem(itemId);
  }

  function handleDndConsider(e: CustomEvent<{ items: ListItemDto[] }>) {
    dragItems = e.detail.items;
  }

  async function handleDndFinalize(e: CustomEvent<{ items: ListItemDto[] }>) {
    dragItems = e.detail.items;
    if (!list) return;
    const listId = list.id;
    const expectedUpdatedAt = list.updatedAt;
    patchList({ items: dragItems });
    try {
      await reorderListItems(
        listId,
        dragItems.map((i) => i.id),
        expectedUpdatedAt,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        conflictNotice = true;
        void queryClient.refetchQueries({ queryKey: detailKey });
        return;
      }
      throw err;
    }
  }

  // Poster tile for the COLLECTION grid. `focused` renders the enlarged copy
  // shown inside FocusOverlay on long-press — there the delete button is
  // always visible (no hover on touch) and the poster isn't a link, since
  // it's a detached DOM copy purely for the delete action.
</script>

{#snippet gridItem(item: ListItemDto, focused: boolean = false)}
  <svelte:element
    this={!focused && item.target?.href ? "a" : "div"}
    href={!focused ? (item.target?.href ?? undefined) : undefined}>
    <div
      class="card group-hover:border-accent overflow-hidden transition-colors">
      <Poster
        src={item.target?.imageUrl ?? null}
        title={item.target?.title ?? "?"} />
    </div>
    <p class="mt-1.5 truncate text-sm font-semibold">
      {item.target?.title ?? m.common_work()}
    </p>
  </svelte:element>
  {#if canEditList}
    <button
      class="bg-bg/80 text-dim hover:bg-danger absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-md backdrop-blur transition-all hover:text-white {focused
        ? 'opacity-100'
        : 'opacity-0 group-hover:opacity-100 group-hover:shadow-md'}"
      aria-label={m.list_item_remove()}
      title={m.list_item_remove()}
      disabled={removingId === item.id}
      onclick={() => (confirmRemoveId = item.id)}>
      <Icon name="trash" class="h-4 w-4" />
    </button>
  {/if}
{/snippet}

{#if conflictNotice}
  <div class="mx-auto max-w-3xl px-4 pt-6 md:pt-8">
    <Banner variant="error">{m.list_reorder_conflict()}</Banner>
  </div>
{/if}

{#if error}
  <div class="mx-auto max-w-3xl px-4 py-6 md:py-8">
    <Banner variant="error">{error}</Banner>
  </div>
{:else if loading}
  <div class="mx-auto max-w-3xl px-4 py-6 md:py-8">
    <div class="skeleton h-8 w-48 rounded"></div>
    <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
      {#each Array(4) as _, i (i)}
        <div class="skeleton aspect-2/3 w-full rounded-xl"></div>
      {/each}
    </div>
  </div>
{:else if list}
  <div class="mx-auto max-w-3xl px-4 py-6 md:py-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="font-display text-3xl font-extrabold tracking-tight">
          {list.title}
        </h1>
        <p class="text-dim mt-1 flex flex-wrap items-center gap-x-2 text-sm">
          <span class="timecode uppercase">{KIND_LABEL[list.kind]}</span>
          {#if appConfig.socialEnabled}
            <span aria-hidden="true">·</span>
            <span>{VISIBILITY_LABEL[list.visibility]}</span>
          {/if}
          {#if role !== "OWNER"}
            <span aria-hidden="true">·</span>
            <a
              href="/app/u/{list.author.username}"
              class="hover:text-fg inline-flex items-center gap-1.5">
              <Avatar
                seed={list.author.username}
                url={list.author.avatarUrl}
                size={18} />
              {role === "EDITOR"
                ? m.list_owned_by_editor({ name: list.author.displayName })
                : list.author.displayName}
            </a>
          {/if}
        </p>
        {#if list.description}
          <p class="mt-3 max-w-xl">{list.description}</p>
        {/if}
      </div>
      <div class="flex shrink-0 gap-2">
        {#if isOwner && appConfig.socialEnabled}
          <button
            class="btn btn-ghost"
            onclick={() => (managingMembers = true)}>
            {m.list_members_manage()}
            {#if isFeatureNew("collaborative-lists")}
              <NewBadge />
            {/if}
          </button>
        {/if}
        {#if canEditList}
          <button class="btn btn-ghost" onclick={() => (editing = true)}>
            {m.common_edit()}
          </button>
        {/if}
        {#if role === "EDITOR"}
          <button
            class="btn btn-ghost"
            disabled={leaveMut.loading}
            onclick={leaveList}>
            {m.list_leave()}
          </button>
        {/if}
      </div>
    </div>

    <hr class="border-border mt-5" />

    {#if dragItems.length === 0}
      <EmptyState class="mt-6">
        <p class="font-display text-lg font-bold">
          {canEditList ? m.list_empty_title() : m.list_empty()}
        </p>
        {#if canEditList}
          <p class="mt-1 text-sm">
            {m.list_empty_hint()}
          </p>
        {/if}
      </EmptyState>
    {:else if list.kind === "RANKED"}
      <ol
        class="mt-6 flex flex-col gap-2"
        use:dndzone={{
          items: dragItems,
          dragDisabled: !canEditList,
          flipDurationMs: 150,
        }}
        onconsider={handleDndConsider}
        onfinalize={handleDndFinalize}>
        {#each dragItems as item, i (item.id)}
          <li class="card flex items-center gap-3 p-3">
            {#if canEditList}
              <Icon name="grip" class="text-dim h-4 w-4 shrink-0 cursor-grab" />
            {/if}
            <span class="timecode text-accent w-7 shrink-0 text-lg font-bold">
              {String(i + 1).padStart(2, "0")}
            </span>
            <svelte:element
              this={item.target?.href ? "a" : "div"}
              href={item.target?.href ?? undefined}
              class="flex min-w-0 flex-1 items-center gap-3">
              <div class="h-16 w-11 shrink-0 overflow-hidden rounded">
                <Poster
                  src={item.target?.imageUrl ?? null}
                  title={item.target?.title ?? "?"} />
              </div>
              <p class="min-w-0 truncate font-semibold">
                {item.target?.title ?? m.common_work()}
              </p>
            </svelte:element>
            {#if canEditList}
              <button
                class="text-dim hover:text-danger hover:bg-danger/10 mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors"
                aria-label={m.list_item_remove()}
                title={m.list_item_remove()}
                disabled={removingId === item.id}
                onclick={() => removeItem(item.id)}>
                <Icon name="trash" class="h-4 w-4" />
              </button>
            {/if}
          </li>
        {/each}
      </ol>
    {:else}
      <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {#each dragItems as item (item.id)}
          <div
            class="group relative"
            role="presentation"
            style="-webkit-touch-callout: none;"
            oncontextmenu={(e) => canEditList && e.preventDefault()}
            use:longpress={{
              onLongPress: () => canEditList && (focusedItemId = item.id),
              duration: 600,
            }}>
            {@render gridItem(item)}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

{#if editing && list}
  <ListFormModal
    {list}
    defaultVisibility={auth.user?.defaultListVisibility ?? "PRIVATE"}
    canManage={isOwner}
    onClose={() => (editing = false)}
    onSaved={handleSaved}
    onDeleted={handleDeleted} />
{/if}

{#if managingMembers && list}
  <ListMembersModal
    listId={list.id}
    onClose={() => (managingMembers = false)} />
{/if}

{#if focusedItemId}
  {@const focusedItem = dragItems.find((i) => i.id === focusedItemId)}
  {#if focusedItem}
    <FocusOverlay onclose={() => (focusedItemId = null)}>
      {#snippet content()}
        <div class="group relative">
          {@render gridItem(focusedItem, true)}
        </div>
      {/snippet}
    </FocusOverlay>
  {/if}
{/if}

{#if confirmRemoveItem}
  <ConfirmationModal
    title={m.list_item_remove_confirm_title()}
    message={m.list_item_remove_confirm_message()}
    confirmLabel={m.common_delete()}
    danger
    busy={removingId === confirmRemoveItem.id}
    onConfirm={confirmRemove}
    onCancel={() => (confirmRemoveId = null)} />
{/if}
