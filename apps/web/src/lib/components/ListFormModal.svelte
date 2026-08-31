<script lang="ts">
  import { createList, deleteList, updateList } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ListDto, ListKind, ListVisibility } from "@loomkeep/shared";
  import Modal from "./Modal.svelte";

  // Shared "create/edit a list" modal. RANKED/COLLECTION share the same
  // storage (items + position), so the kind can be switched freely even with
  // existing items — a COLLECTION just stops showing/using the rank order.
  let {
    list = null,
    defaultVisibility = "PRIVATE",
    canManage = true,
    onClose,
    onSaved,
    onDeleted,
  }: {
    list?: ListDto | null;
    defaultVisibility?: ListVisibility;
    /** False for an editor: can rename/describe the list, but not change its
     * visibility, delete it, or manage collaborators (owner-only). */
    canManage?: boolean;
    onClose: () => void;
    onSaved: (list: ListDto) => void;
    onDeleted?: () => void;
  } = $props();

  let title = $derived(list?.title ?? "");
  let description = $derived(list?.description ?? "");
  let kind: ListKind = $derived(list?.kind ?? "COLLECTION");
  let visibility: ListVisibility = $derived(
    list?.visibility ?? defaultVisibility,
  );
  let confirmingDelete = $state(false);

  const saveMut = createApiMutation(() => ({
    mutate: () =>
      list
        ? updateList(list.id, {
            title: title.trim(),
            description: description.trim() || null,
            visibility: canManage ? visibility : undefined,
            kind,
          })
        : createList({
            title: title.trim(),
            description: description.trim() || null,
            kind,
            visibility,
          }),
    coveredFields: ["title", "description"],
    onSuccess: (saved) => {
      onSaved(saved);
      onClose();
    },
  }));

  function save() {
    if (!title.trim() || saveMut.loading) return;
    saveMut.mutate();
  }

  const deleteMut = createApiMutation(() => ({
    mutate: () => deleteList(list!.id),
    onSuccess: () => {
      onDeleted?.();
      onClose();
    },
  }));

  function doDelete() {
    if (!list || deleteMut.loading) return;
    deleteMut.mutate();
  }

  const busy = $derived(saveMut.loading || deleteMut.loading);
  const error = $derived(saveMut.error ?? deleteMut.error);
</script>

<Modal
  title={list ? m.lists_edit() : m.lists_create_button()}
  onclose={onClose}>
  <div class="space-y-4">
    <div>
      <label
        for="list-title"
        class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
        {m.common_title()}
      </label>
      <input
        id="list-title"
        type="text"
        name="title"
        class="input"
        minlength="1"
        maxlength={100}
        required
        placeholder={m.lists_title_placeholder()}
        bind:value={title} />
    </div>

    <div>
      <label
        for="list-description"
        class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
        {m.common_description()}
        {m.common_optional_marker()}
      </label>
      <textarea
        id="list-description"
        name="description"
        class="input min-h-16 resize-y"
        rows="3"
        maxlength={500}
        bind:value={description}></textarea>
    </div>

    <div>
      <span
        class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
        {m.common_type()}
      </span>
      <div class="flex gap-2">
        <button
          type="button"
          class="chip"
          class:chip-on={kind === "COLLECTION"}
          onclick={() => (kind = "COLLECTION")}>
          {m.lists_kind_collection()}
        </button>
        <button
          type="button"
          class="chip"
          class:chip-on={kind === "RANKED"}
          onclick={() => (kind = "RANKED")}>
          {m.lists_kind_ranked()}
        </button>
      </div>
      <p class="text-dim mt-1 text-xs">
        {kind === "RANKED" ? m.lists_ranked_hint() : m.lists_collection_hint()}
      </p>
    </div>

    {#if appConfig.socialEnabled && canManage}
      <div>
        <span
          class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
          {m.common_visible_to()}
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            class="chip"
            class:chip-on={visibility === "PRIVATE"}
            onclick={() => (visibility = "PRIVATE")}>
            {m.common_private()}
          </button>
          <button
            type="button"
            class="chip"
            class:chip-on={visibility === "FRIENDS"}
            onclick={() => (visibility = "FRIENDS")}>
            {m.common_friends()}
          </button>
          <button
            type="button"
            class="chip"
            class:chip-on={visibility === "PUBLIC"}
            onclick={() => (visibility = "PUBLIC")}>
            {m.common_public()}
          </button>
        </div>
      </div>
    {/if}

    {#if error}
      <p class="text-danger text-sm">{error}</p>
    {/if}

    <div class="flex items-center gap-2 pt-1">
      <button
        class="btn btn-primary flex-1"
        disabled={busy || !title.trim()}
        onclick={save}>
        {m.common_save()}
      </button>
      {#if list && canManage}
        {#if confirmingDelete}
          <button class="btn btn-danger" disabled={busy} onclick={doDelete}>
            {m.common_confirm()}
          </button>
        {:else}
          <button
            class="btn btn-ghost"
            disabled={busy}
            onclick={() => (confirmingDelete = true)}>
            {m.common_delete()}
          </button>
        {/if}
      {/if}
    </div>
  </div>
</Modal>
