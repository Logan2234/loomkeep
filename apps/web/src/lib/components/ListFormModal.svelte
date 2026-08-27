<script lang="ts">
  import { createList, deleteList, updateList } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
  import { fieldError } from "$lib/api/validation-messages";
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
  let busy = $state(false);
  let confirmingDelete = $state(false);
  let error = $state("");

  async function save() {
    if (!title.trim() || busy) return;
    busy = true;
    error = "";
    try {
      const saved = list
        ? await updateList(list.id, {
            title: title.trim(),
            description: description.trim() || null,
            visibility: canManage ? visibility : undefined,
            kind,
          })
        : await createList({
            title: title.trim(),
            description: description.trim() || null,
            kind,
            visibility,
          });
      onSaved(saved);
      onClose();
    } catch (err) {
      error =
        fieldError(err, "title") ??
        fieldError(err, "description") ??
        resolveApiError(err);
    } finally {
      busy = false;
    }
  }

  async function doDelete() {
    if (!list || busy) return;
    busy = true;
    error = "";
    try {
      await deleteList(list.id);
      onDeleted?.();
      onClose();
    } catch (err) {
      error = resolveApiError(err);
    } finally {
      busy = false;
    }
  }
</script>

<Modal title={list ? "Modifier la liste" : "Créer une liste"} onclose={onClose}>
  <div class="space-y-4">
    <div>
      <label
        for="list-title"
        class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
        Titre
      </label>
      <input
        id="list-title"
        type="text"
        class="input"
        maxlength={100}
        placeholder="Mon top 10…"
        bind:value={title} />
    </div>

    <div>
      <label
        for="list-description"
        class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
        Description · optionnel
      </label>
      <textarea
        id="list-description"
        class="input min-h-16 resize-y"
        maxlength={500}
        bind:value={description}></textarea>
    </div>

    <div>
      <span
        class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
        Type
      </span>
      <div class="flex gap-2">
        <button
          type="button"
          class="chip"
          class:chip-on={kind === "COLLECTION"}
          onclick={() => (kind = "COLLECTION")}>
          Collection
        </button>
        <button
          type="button"
          class="chip"
          class:chip-on={kind === "RANKED"}
          onclick={() => (kind = "RANKED")}>
          Classement
        </button>
      </div>
      <p class="text-dim mt-1 text-xs">
        {kind === "RANKED"
          ? "Ordre affiché et réordonnable (façon « top 10 »)."
          : "Grille sans ordre particulier."}
      </p>
    </div>

    {#if appConfig.socialEnabled && canManage}
      <div>
        <span
          class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
          Visible par
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
