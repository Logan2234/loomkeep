<script lang="ts">
  import Modal from "#lib/components/Modal.svelte";
  import PasswordInput from "#lib/components/PasswordInput.svelte";
  import { m } from "#lib/paraglide/messages.js";
  let {
    title,
    description,
    password = $bindable(""),
    busy,
    error,
    confirmLabel,
    danger = false,
    onconfirm,
    onclose,
  }: {
    title: string;
    description: string;
    password?: string;
    busy: boolean;
    error: string | null;
    confirmLabel: string;
    danger?: boolean;
    onconfirm: () => void;
    onclose: () => void;
  } = $props();
</script>

<Modal {title} {onclose}>
  <form
    class="flex flex-col gap-3"
    onsubmit={(e) => {
      e.preventDefault();
      onconfirm();
    }}>
    <p class="text-sm">{description}</p>
    <label class="block"
      ><span class="mb-1.5 block text-sm font-semibold"
        >{m.common_current_password()}</span
      ><PasswordInput
        name="currentPassword"
        autocomplete="current-password"
        enterkeyhint="done"
        minlength={1}
        required
        bind:value={password} /></label>
    {#if error}<p class="text-danger text-sm">{error}</p>{/if}
    <div class="mt-2 flex justify-end gap-2">
      <button type="button" class="btn btn-ghost" onclick={onclose}
        >{m.common_cancel()}</button
      ><button
        type="submit"
        class="btn {danger ? 'btn-danger' : 'btn-primary'}"
        disabled={busy || !password}
        >{busy ? m.common_save_loading() : confirmLabel}</button>
    </div>
  </form>
</Modal>
