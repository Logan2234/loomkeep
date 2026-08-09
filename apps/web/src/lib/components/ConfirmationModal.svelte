<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import Modal from "./Modal.svelte";

  // Confirm a consequential action (e.g. removing a library entry) in-place,
  // replacing the browser's native confirm(). The caller keeps the trigger
  // state; this only renders when mounted.
  let {
    title,
    message,
    confirmLabel = m.common_confirm(),
    cancelLabel = m.common_cancel(),
    danger = false,
    busy = false,
    onConfirm,
    onCancel,
  }: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();
</script>

<Modal {title} onclose={onCancel}>
  <p class="text-dim">{message}</p>
  <div class="mt-5 flex justify-end gap-2">
    <button
      type="button"
      class="btn btn-ghost"
      disabled={busy}
      onclick={onCancel}>
      {cancelLabel}
    </button>
    <button
      type="button"
      class="btn {danger ? 'btn-danger' : 'btn-primary'}"
      disabled={busy}
      onclick={onConfirm}>
      {confirmLabel}
    </button>
  </div>
</Modal>
