<script lang="ts">
  import Banner from "$lib/components/Banner.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import { MODERATION_LEGAL_BASIS_LABELS } from "$lib/constants/report-labels";
  import { m } from "$lib/paraglide/messages.js";
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
      class="border-border bg-surface mt-3 w-full rounded-lg border px-3 py-2 text-sm" />

    <p class="text-dim mt-4 text-xs">
      {m.admin_users_statement_description()}
    </p>
    <label class="mt-2 block text-sm font-semibold" for="delete-reason">
      {m.admin_moderation_facts()}
    </label>
    <textarea
      id="delete-reason"
      name="reasonText"
      bind:value={reasonText}
      disabled={busy}
      rows="3"
      class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm"
      placeholder={m.admin_users_reason_placeholder()}></textarea>
    <span class="mt-3 block text-sm font-semibold">
      {m.admin_moderation_basis()}
    </span>
    <Combobox
      label={m.admin_moderation_basis()}
      name="legalBasis"
      options={Object.entries(MODERATION_LEGAL_BASIS_LABELS).map(
        ([value, label]) => ({
          label,
          value,
        }),
      )}
      values={[legalBasis]}
      disabled={busy}
      onChange={(v) => (legalBasis = v[0] as ModerationLegalBasis)} />
    {#if legalBasis === "TOS_BREACH"}
      <label class="mt-3 block text-sm font-semibold" for="delete-clause">
        {m.admin_moderation_terms_clause()}
      </label>
      <input
        id="delete-clause"
        type="text"
        name="tosClause"
        bind:value={tosClause}
        disabled={busy}
        class="border-border bg-surface mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        placeholder={m.admin_users_clause_placeholder()} />
    {/if}

    {#if error}
      <Banner variant="error" class="mt-3">{error}</Banner>
    {:else if fieldErrors.reasonText || fieldErrors.legalBasis || fieldErrors.tosClause}
      <Banner variant="error" class="mt-3">
        {fieldErrors.reasonText ??
          fieldErrors.legalBasis ??
          fieldErrors.tosClause}
      </Banner>
    {/if}
    <div class="mt-5 flex justify-end gap-2">
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
          : m.settings_delete_account_confirm()}
      </button>
    </div>
  </div>
</Modal>
