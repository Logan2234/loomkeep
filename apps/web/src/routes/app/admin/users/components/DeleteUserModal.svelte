<script lang="ts">
  import ModerationStatementFields from "#lib/components/admin/ModerationStatementFields.svelte";
  import Banner from "#lib/components/Banner.svelte";

  import Modal from "#lib/components/Modal.svelte";

  import { m } from "#lib/paraglide/messages.js";
  import type { ModerationLegalBasis } from "@loomkeep/shared";

  let {
    username,
    displayName,
    busy,
    error,
    fieldErrors,
    onConfirm,
    onCancel,
  }: {
    username: string;
    displayName: string;
    busy: boolean;
    error: string | null;
    fieldErrors: Record<string, string>;
    onConfirm: (args: {
      reasonText: string;
      legalBasis: ModerationLegalBasis;
      tosClause: string;
    }) => void;
    onCancel: () => void;
  } = $props();

  let confirmText = $state("");
  let reasonText = $state("");
  let legalBasis = $state<ModerationLegalBasis>("TOS_BREACH");
  let tosClause = $state("");

  function close() {
    if (busy) return;
    onCancel();
  }

  function confirm() {
    onConfirm({ reasonText, legalBasis, tosClause });
  }
</script>

<Modal
  title={m.settings_delete_account_modal_title()}
  onclose={close}
  dismissable={!busy}>
  <div>
    <p class="text-dim text-sm">
      {m.admin_users_delete_intro()}
      <strong class="text-fg">{displayName}</strong>
      {m.admin_users_delete_warning()}
    </p>
    <p class="text-dim mt-3 text-sm">
      {m.admin_users_confirm_type()}
      <code class="bg-surface-2 text-fg rounded px-1.5 py-0.5 text-xs font-bold"
        >{username}</code>
      {m.admin_confirmation_below()}
    </p>
    <input
      type="text"
      name="confirmation"
      bind:value={confirmText}
      disabled={busy}
      placeholder={username}
      class="input mt-3 text-sm" />

    <p class="text-dim mt-4 text-xs">
      {m.admin_users_statement_description()}
    </p>
    <ModerationStatementFields
      idPrefix="delete"
      bind:reasonText
      bind:legalBasis
      bind:tosClause
      disabled={busy}
      reasonPlaceholder={m.admin_users_reason_placeholder()}
      clausePlaceholder={m.admin_users_clause_placeholder()}
      reasonMargin="mt-2" />

    {#if error}
      <Banner variant="error" class="mt-3">{error}</Banner>
    {:else if fieldErrors.reasonText || fieldErrors.legalBasis || fieldErrors.tosClause}
      <Banner variant="error" class="mt-3">
        {fieldErrors.reasonText ??
          fieldErrors.legalBasis ??
          fieldErrors.tosClause}
      </Banner>
    {/if}
  </div>
  {#snippet actions()}
    <div class="flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={busy}
        onclick={close}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-danger"
        disabled={busy || confirmText !== username || !reasonText.trim()}
        onclick={confirm}>
        {busy
          ? m.settings_delete_account_deleting()
          : m.admin_users_delete_permanently()}
      </button>
    </div>
  {/snippet}
</Modal>
