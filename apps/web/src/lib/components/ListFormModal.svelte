<script lang="ts">
  import { createList, deleteList, updateList } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ListDto, ListKind, ListVisibility } from "@loomkeep/shared";
  import { prefersReducedMotion } from "$lib/motion";
  import { fade } from "svelte/transition";
  import Modal from "./Modal.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";

  // Shared "create/edit a list" modal. RANKED/COLLECTION share the same
  // storage (items + position), so the kind can be switched freely even with
  // existing items — a COLLECTION just stops showing/using the rank order.
  let {
    list = null,
    defaultVisibility = "PRIVATE",
    canManage = true,
    canDelete = canManage,
    onClose,
    onSaved,
    onDeleted,
  }: {
    list?: ListDto | null;
    defaultVisibility?: ListVisibility;
    /** False for an editor: can rename/describe the list, but not change its
     * visibility, delete it, or manage collaborators (owner-only). */
    canManage?: boolean;
    /** A moderator manages visibility but deletes only through a decision. */
    canDelete?: boolean;
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

  const reduced = prefersReducedMotion();

  const KINDS: { value: ListKind; label: string; hint: string }[] = [
    {
      value: "COLLECTION",
      label: m.lists_kind_collection(),
      hint: m.lists_collection_hint(),
    },
    {
      value: "RANKED",
      label: m.lists_kind_ranked(),
      hint: m.lists_ranked_hint(),
    },
  ];

  const VISIBILITY_OPTIONS: {
    value: ListVisibility;
    label: string;
    icon: "lock" | "users" | "globe";
  }[] = [
    { value: "PRIVATE", label: m.common_private(), icon: "lock" },
    { value: "FRIENDS", label: m.common_friends(), icon: "users" },
    { value: "PUBLIC", label: m.common_public(), icon: "globe" },
  ];

  const VISIBILITY_HINT: Record<ListVisibility, string> = {
    PRIVATE: m.lists_visibility_private_hint(),
    FRIENDS: m.lists_visibility_friends_hint(),
    PUBLIC: m.lists_visibility_public_hint(),
  };

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
      <div class="grid grid-cols-2 gap-2" role="group">
        {#each KINDS as option (option.value)}
          {@const on = kind === option.value}
          <button
            type="button"
            aria-pressed={on}
            class="group flex flex-col gap-2.5 rounded-xl border p-3 text-left transition-[border-color,box-shadow,background-color] {on
              ? 'border-accent ring-accent bg-accent/5 ring-1'
              : 'border-border hover:border-dim'}"
            onclick={() => (kind = option.value)}>
            <span
              class="bg-surface-2 flex h-14 gap-1.5 rounded-lg p-2"
              class:flex-col={option.value === "RANKED"}
              class:justify-center={option.value === "RANKED"}
              aria-hidden="true">
              {#if option.value === "COLLECTION"}
                {#each Array(4) as _, i (i)}
                  <span
                    class="flex-1 rounded-sm transition-colors {on
                      ? 'bg-accent/45'
                      : 'bg-dim/30'}"></span>
                {/each}
              {:else}
                {#each [80, 62, 45] as width, i (i)}
                  <span class="flex items-center gap-1.5">
                    <span
                      class="timecode text-accent w-2 text-[0.6rem] font-bold"
                      >{i + 1}</span>
                    <span
                      class="h-1.5 rounded-sm transition-colors {on
                        ? 'bg-accent/45'
                        : 'bg-dim/30'}"
                      style="width: {width}%"></span>
                  </span>
                {/each}
              {/if}
            </span>
            <span>
              <span class="block text-sm font-semibold">{option.label}</span>
              <span class="text-dim block text-xs">{option.hint}</span>
            </span>
          </button>
        {/each}
      </div>
    </div>

    {#if appConfig.socialEnabled && canManage}
      <div>
        <span
          class="timecode mb-1 block text-[0.62rem] tracking-[0.18em] uppercase">
          {m.common_visible_to()}
        </span>
        <SegmentedControl
          class="w-full [&>*]:flex-1 [&>*]:justify-center"
          label={m.common_visible_to()}
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(next) => (visibility = next)} />
        {#key visibility}
          <p
            class="text-dim mt-1.5 text-xs"
            in:fade={{ duration: reduced ? 0 : 160 }}>
            {VISIBILITY_HINT[visibility]}
          </p>
        {/key}
      </div>
    {/if}

    {#if error}
      <p class="text-danger text-sm">{error}</p>
    {/if}
  </div>

  {#snippet actions()}
    <div class="flex items-center gap-2">
      <button
        class="btn btn-primary flex-1"
        disabled={busy || !title.trim()}
        onclick={save}>
        {m.common_save()}
      </button>
      {#if list && canDelete}
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
  {/snippet}
</Modal>
