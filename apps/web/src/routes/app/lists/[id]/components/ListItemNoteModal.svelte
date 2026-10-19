<script lang="ts">
  import { LIST_LIMITS, type ListItemDto } from "@loomkeep/shared";

  import { setListItemNote } from "#lib/api/lists.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import Modal from "#lib/components/Modal.svelte";
  import { m } from "#lib/paraglide/messages.js";

  let {
    listId,
    item,
    onSaved,
    onclose,
  }: {
    listId: string;
    item: ListItemDto;
    onSaved: (item: ListItemDto) => void;
    onclose: () => void;
  } = $props();

  let draft = $state(item.note ?? "");

  const saveMut = createApiMutation(() => ({
    mutate: (note: string | null) => setListItemNote(listId, item.id, note),
    coveredFields: ["note"],
    onSuccess: (saved: ListItemDto) => {
      onSaved(saved);
      onclose();
    },
  }));
  const saving = $derived(saveMut.loading);
</script>

<Modal
  title={m.list_item_note_title({
    title: item.target?.title ?? m.common_work(),
  })}
  {onclose}>
  <!-- The submit button lives in the pinned footer, outside this form —
       `form="…"` is what still submits it from there. -->
  <form
    id="list-item-note-form"
    class="flex flex-col gap-1.5"
    onsubmit={(e) => {
      e.preventDefault();
      saveMut.mutate(draft.trim() || null);
    }}>
    <label class="text-sm" for="list-item-note">
      {m.list_item_note_label()}
    </label>
    <textarea
      id="list-item-note"
      name="note"
      class="input min-h-20 resize-y"
      rows="3"
      maxlength={LIST_LIMITS.itemNote}
      placeholder={m.list_item_note_placeholder()}
      bind:value={draft}></textarea>
    <p class="text-dim self-end font-mono text-[0.68rem]">
      {draft.length}/{LIST_LIMITS.itemNote}
    </p>
    {#if saveMut.error}
      <p class="text-danger text-xs">{saveMut.error}</p>
    {/if}
  </form>

  {#snippet actions()}
    <div class="flex flex-wrap justify-end gap-2">
      {#if item.note}
        <button
          type="button"
          class="btn btn-ghost text-danger mr-auto"
          disabled={saving}
          onclick={() => saveMut.mutate(null)}>
          {m.list_item_note_clear()}
        </button>
      {/if}
      <button type="button" class="btn btn-ghost" onclick={onclose}>
        {m.common_cancel()}
      </button>
      <button
        class="btn btn-primary"
        disabled={saving}
        type="submit"
        form="list-item-note-form">
        {saving ? m.common_save_loading() : m.common_save()}
      </button>
    </div>
  {/snippet}
</Modal>
