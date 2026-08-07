<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import { page } from "$app/state";
  import {
    ApiError,
    getList,
    getMyList,
    removeListItem,
    reorderListItems,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ListFormModal from "$lib/components/ListFormModal.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { appConfig } from "$lib/config.svelte";
  import type { ListDetailDto, ListDto, ListItemDto } from "@loomkeep/shared";

  const KIND_LABEL: Record<string, string> = {
    RANKED: "Classement",
    COLLECTION: "Collection",
  };
  const VISIBILITY_LABEL: Record<string, string> = {
    PRIVATE: "Privé",
    FRIENDS: "Amis",
    PUBLIC: "Public",
  };

  const id = $derived(page.params.id ?? "");

  let list = $state<ListDetailDto | null>(null);
  let isMine = $state(false);
  let error = $state<string | null>(null);
  let loading = $state(true);
  let editing = $state(false);
  let removingId = $state<string | null>(null);

  // Local, reorderable copy of the items — svelte-dnd-action mutates this
  // directly during a drag; `list.items` stays the source of truth otherwise.
  let dragItems = $state<ListItemDto[]>([]);

  $effect(() => {
    const listId = id;
    if (!listId) return;
    loading = true;
    error = null;
    list = null;

    getMyList(listId)
      .then((d) => {
        list = d;
        isMine = true;
        dragItems = d.items;
      })
      .catch((err) => {
        if (
          err instanceof ApiError &&
          (err.status === 403 || err.status === 404)
        ) {
          return getList(listId)
            .then((d) => {
              list = d;
              isMine = false;
              dragItems = d.items;
            })
            .catch(() => {
              error = "Liste introuvable ou non accessible.";
            });
        }
        error = err instanceof ApiError ? err.message : "Chargement impossible";
      })
      .finally(() => (loading = false));
  });

  function handleSaved(updated: ListDto) {
    if (!list) return;
    list = { ...list, ...updated };
  }

  function handleDeleted() {
    window.location.href = "/lists";
  }

  async function removeItem(itemId: string) {
    if (!list || removingId) return;
    removingId = itemId;
    try {
      await removeListItem(list.id, itemId);
      dragItems = dragItems.filter((i) => i.id !== itemId);
      list = { ...list, items: dragItems };
    } finally {
      removingId = null;
    }
  }

  function handleDndConsider(e: CustomEvent<{ items: ListItemDto[] }>) {
    dragItems = e.detail.items;
  }

  async function handleDndFinalize(e: CustomEvent<{ items: ListItemDto[] }>) {
    dragItems = e.detail.items;
    if (!list) return;
    list = { ...list, items: dragItems };
    await reorderListItems(
      list.id,
      dragItems.map((i) => i.id),
    );
  }
</script>

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
    <div class="flex items-start justify-between gap-4">
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
          {#if !isMine}
            <span aria-hidden="true">·</span>
            <a
              href="/u/{list.author.username}"
              class="hover:text-fg inline-flex items-center gap-1.5">
              <Avatar
                seed={list.author.username}
                url={list.author.avatarUrl}
                size={18} />
              @{list.author.username}
            </a>
          {/if}
        </p>
        {#if list.description}
          <p class="mt-3 max-w-xl">{list.description}</p>
        {/if}
      </div>
      {#if isMine}
        <button class="btn btn-ghost shrink-0" onclick={() => (editing = true)}>
          Modifier
        </button>
      {/if}
    </div>

    <hr class="border-border mt-5" />

    {#if dragItems.length === 0}
      <EmptyState class="mt-6">
        <p class="font-display text-lg font-bold">
          {isMine ? "Liste vide" : "Cette liste est vide"}
        </p>
        {#if isMine}
          <p class="mt-1 text-sm">
            Ajoute une œuvre depuis sa page avec « Ajouter à une liste ».
          </p>
        {/if}
      </EmptyState>
    {:else if list.kind === "RANKED"}
      <ol
        class="mt-6 flex flex-col gap-2"
        use:dndzone={{
          items: dragItems,
          dragDisabled: !isMine,
          flipDurationMs: 150,
        }}
        onconsider={handleDndConsider}
        onfinalize={handleDndFinalize}>
        {#each dragItems as item, i (item.id)}
          <li class="card flex items-center gap-3 p-3">
            {#if isMine}
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
                {item.target?.title ?? "Œuvre"}
              </p>
            </svelte:element>
            {#if isMine}
              <button
                class="text-dim hover:text-danger hover:bg-danger/10 mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors"
                aria-label="Retirer de la liste"
                title="Retirer de la liste"
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
          <div class="group relative">
            <svelte:element
              this={item.target?.href ? "a" : "div"}
              href={item.target?.href ?? undefined}>
              <div
                class="card group-hover:border-accent overflow-hidden transition-colors">
                <Poster
                  src={item.target?.imageUrl ?? null}
                  title={item.target?.title ?? "?"} />
              </div>
              <p class="mt-1.5 truncate text-sm font-semibold">
                {item.target?.title ?? "Œuvre"}
              </p>
            </svelte:element>
            {#if isMine}
              <button
                class="bg-bg/80 text-dim hover:bg-danger absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-md backdrop-blur transition-colors hover:text-white"
                aria-label="Retirer de la liste"
                title="Retirer de la liste"
                disabled={removingId === item.id}
                onclick={() => removeItem(item.id)}>
                <Icon name="trash" class="h-4 w-4" />
              </button>
            {/if}
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
    onClose={() => (editing = false)}
    onSaved={handleSaved}
    onDeleted={handleDeleted} />
{/if}
