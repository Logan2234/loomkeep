<script lang="ts">
  import {
    confirmTotp,
    disableTotp,
    getMfaStatus,
    regenerateRecoveryCodes,
    setEmailMfa,
    setupTotp,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import type { MfaStatusDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import QRCode from "qrcode";

  const RECOVERY_CODES_LOW_THRESHOLD = 2;

  type MfaModal =
    | "totp-setup"
    | "totp-disable"
    | "recovery-regenerate-confirm"
    | "recovery-reveal"
    | null;

  let openModal = $state<MfaModal>(null);

  const queryClient = useQueryClient();
  const statusQuery = createApiQuery(() => ({
    key: keys.mfa.status(),
    fetch: getMfaStatus,
  }));
  const status = $derived(statusQuery.data);

  // Every mutation below only runs from a control rendered inside
  // `{#if status}`, so `status` is always non-null by the time this fires.
  function patchStatus(patch: Partial<MfaStatusDto>) {
    queryClient.setQueryData(
      keys.mfa.status(),
      (old: MfaStatusDto | undefined) => (old ? { ...old, ...patch } : old),
    );
  }

  // --- TOTP setup ---
  let totpStep: "scan" | "confirm" = $state("scan");
  let totpOtpauthUri = $state("");
  let totpSecret = $state("");
  let totpQrSvg = $state("");
  let totpCodeInput = $state("");

  const totpSetupMut = createApiMutation(() => ({
    mutate: setupTotp,
    errorToast: true,
    onSuccess: async (setup) => {
      totpOtpauthUri = setup.otpauthUri;
      totpSecret = setup.secret;
      totpQrSvg = await QRCode.toString(totpOtpauthUri, {
        type: "svg",
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
    },
    onError: () => (openModal = null),
  }));

  function openTotpSetup() {
    totpStep = "scan";
    totpCodeInput = "";
    totpQrSvg = "";
    openModal = "totp-setup";
    totpSetupMut.mutate();
  }

  const totpConfirmMut = createApiMutation(() => ({
    mutate: (code: string) => confirmTotp({ code }),
    onSuccess: ({ recoveryCodes }) => {
      patchStatus({ totpEnabled: true });
      if (recoveryCodes) {
        openRecoveryReveal(recoveryCodes);
      } else {
        openModal = null;
        toast.success(m.auth_mfa_totp_label());
      }
    },
  }));

  function confirmTotpSetup() {
    totpConfirmMut.mutate(totpCodeInput.trim());
  }

  // --- TOTP disable ---
  let disablePasswordInput = $state("");

  function openTotpDisable() {
    disablePasswordInput = "";
    totpDisableMut.reset();
    openModal = "totp-disable";
  }

  const totpDisableMut = createApiMutation(() => ({
    mutate: () => disableTotp({ currentPassword: disablePasswordInput }),
    coveredFields: ["currentPassword"],
    onSuccess: () => {
      patchStatus({ totpEnabled: false });
      openModal = null;
      toast.success(m.common_disable());
    },
  }));

  function confirmTotpDisable() {
    totpDisableMut.mutate();
  }

  // --- Email MFA (direct toggle, no confirmation modal) ---
  const emailMfaMut = createApiMutation(() => ({
    mutate: (next: boolean) => setEmailMfa({ enabled: next }),
    errorToast: true,
    onSuccess: ({ recoveryCodes }, next) => {
      patchStatus({ emailEnabled: next });
      if (recoveryCodes) openRecoveryReveal(recoveryCodes);
    },
  }));

  function onToggleEmail(next: boolean) {
    emailMfaMut.mutate(next);
  }

  // --- Recovery codes ---
  let revealedCodes = $state<string[]>([]);
  let recoveryCopied = $state(false);

  function openRecoveryReveal(codes: string[]) {
    revealedCodes = codes;
    recoveryCopied = false;
    openModal = "recovery-reveal";
  }

  const regenerateMut = createApiMutation(() => ({
    mutate: regenerateRecoveryCodes,
    errorToast: true,
    onSuccess: ({ codes }) => {
      patchStatus({ recoveryCodesRemaining: codes.length });
      openRecoveryReveal(codes);
    },
    onError: () => (openModal = null),
  }));

  function confirmRegenerate() {
    regenerateMut.mutate();
  }

  async function copyAllCodes() {
    await navigator.clipboard.writeText(revealedCodes.join("\n"));
    recoveryCopied = true;
    setTimeout(() => (recoveryCopied = false), 2000);
  }

  const groupCode = (code: string): string =>
    `${code.slice(0, 5)}-${code.slice(5)}`;

  function closeModal() {
    openModal = null;
  }

  const hasAnyMfa = $derived(
    !!status && (status.totpEnabled || status.emailEnabled),
  );
</script>

<section class="card mb-5 p-5 md:p-6">
  <h2 class="font-display mb-4 flex items-center gap-2 text-lg font-bold">
    {m.settings_section_mfa()}
    {#if isFeatureNew("mfa")}<NewBadge />{/if}
  </h2>

  {#if status}
    <div class="divide-border divide-y">
      <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
        <div class="flex items-start gap-3">
          <Icon name="qr-code" class="text-dim mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p class="font-semibold">{m.auth_mfa_totp_label()}</p>
            <p class="text-dim text-sm">{m.settings_mfa_totp_desc()}</p>
          </div>
        </div>
        <Switch
          label={m.auth_mfa_totp_label()}
          checked={status.totpEnabled}
          onChange={(next) => (next ? openTotpSetup() : openTotpDisable())} />
      </div>

      <div
        class="flex items-center justify-between gap-4 {hasAnyMfa
          ? 'py-3'
          : 'pt-3'}">
        <div class="flex items-start gap-3">
          <Icon name="mail" class="text-dim mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p class="font-semibold">{m.auth_mfa_email_label()}</p>
            <p class="text-dim text-sm">{m.settings_mfa_email_desc()}</p>
          </div>
        </div>
        <Switch
          label={m.auth_mfa_email_label()}
          checked={status.emailEnabled}
          onChange={onToggleEmail} />
      </div>

      {#if hasAnyMfa}
        <div class="flex items-center justify-between gap-4 pt-3">
          <div>
            <p class="font-semibold">
              {m.settings_mfa_recovery_title()}

              {#if status.recoveryCodesRemaining <= RECOVERY_CODES_LOW_THRESHOLD}
                <span
                  class="text-warning shrink-0"
                  aria-hidden="true"
                  title={m.settings_mfa_recovery_low_warning({
                    count: status.recoveryCodesRemaining,
                  })}>
                  <Icon name="warning" class="ml-1 inline h-5 w-5" />
                </span>
                <span class="sr-only"
                  >{m.settings_mfa_recovery_low_warning({
                    count: status.recoveryCodesRemaining,
                  })}</span>
              {/if}
            </p>
            <p class="text-dim text-sm">{m.settings_mfa_recovery_hint()}</p>
          </div>
          <button
            class="link-accent shrink-0 text-sm"
            onclick={() => (openModal = "recovery-regenerate-confirm")}>
            {m.common_regenerate()}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</section>

{#if openModal === "totp-setup"}
  <Modal title={m.settings_mfa_totp_setup_title()} onclose={closeModal}>
    {#if totpStep === "scan"}
      <div class="flex flex-col items-center gap-4">
        {#if totpQrSvg}
          <div class="qr-frame rounded-xl bg-white p-3">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html totpQrSvg}
          </div>
        {:else}
          <div class="bg-surface-2 h-48 w-48 animate-pulse rounded-xl"></div>
        {/if}
        <p class="text-dim max-w-xs text-center text-sm">
          {m.settings_mfa_totp_scan_hint()}
        </p>
        {#if totpSecret}
          <p class="w-full text-center">
            <span class="text-dim text-xs"
              >{m.settings_mfa_totp_manual_entry_label()}</span>
            <span class="block font-mono text-sm tracking-widest select-all">
              {totpSecret}
            </span>
          </p>
        {/if}
        <button
          type="button"
          class="btn btn-primary w-full"
          disabled={!totpQrSvg}
          onclick={() => (totpStep = "confirm")}>
          {m.common_next()}
        </button>
      </div>
    {:else}
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => {
          e.preventDefault();
          confirmTotpSetup();
        }}>
        <p class="text-sm">{m.settings_mfa_totp_confirm_hint()}</p>
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">
            {m.common_code()}
          </span>
          <input
            type="text"
            inputmode="numeric"
            maxlength="6"
            class="input font-mono text-lg tracking-[0.3em]"
            placeholder="000000"
            bind:value={totpCodeInput} />
        </label>
        {#if totpConfirmMut.error}
          <p class="text-danger text-sm">
            {m.settings_mfa_totp_invalid_code()}
          </p>
        {/if}
        <div class="mt-2 flex justify-end gap-2">
          <button
            type="button"
            class="btn btn-ghost"
            onclick={() => (totpStep = "scan")}>
            {m.common_back()}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={totpConfirmMut.loading ||
              totpCodeInput.trim().length !== 6}>
            {totpConfirmMut.loading
              ? m.common_save_loading()
              : m.common_enable()}
          </button>
        </div>
      </form>
    {/if}
  </Modal>
{/if}

{#if openModal === "totp-disable"}
  <Modal title={m.settings_mfa_totp_disable_title()} onclose={closeModal}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        confirmTotpDisable();
      }}>
      <p class="text-sm">{m.settings_mfa_totp_disable_hint()}</p>
      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">
          {m.common_current_password()}
        </span>
        <PasswordInput
          autocomplete="current-password"
          bind:value={disablePasswordInput} />
      </label>
      {#if totpDisableMut.error}
        <p class="text-danger text-sm">{totpDisableMut.error}</p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" onclick={closeModal}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-danger"
          disabled={totpDisableMut.loading || !disablePasswordInput}>
          {totpDisableMut.loading
            ? m.common_save_loading()
            : m.common_disable()}
        </button>
      </div>
    </form>
  </Modal>
{/if}

{#if openModal === "recovery-regenerate-confirm"}
  <ConfirmationModal
    title={m.settings_mfa_recovery_regenerate_confirm_title()}
    message={m.settings_mfa_recovery_regenerate_confirm_message()}
    confirmLabel={m.common_regenerate()}
    danger
    busy={regenerateMut.loading}
    onConfirm={confirmRegenerate}
    onCancel={closeModal} />
{/if}

{#if openModal === "recovery-reveal"}
  <Modal title={m.settings_mfa_recovery_reveal_title()} onclose={closeModal}>
    <p class="text-dim mb-4 text-sm">{m.settings_mfa_recovery_reveal_hint()}</p>
    <div
      class="border-border bg-surface-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-dashed p-4">
      {#each revealedCodes as code (code)}
        <p class="text-center font-mono text-sm tracking-wider tabular-nums">
          {groupCode(code)}
        </p>
      {/each}
    </div>
    <div class="mt-4 flex flex-col gap-2">
      <button class="btn btn-ghost w-full" onclick={copyAllCodes}>
        <Icon name={recoveryCopied ? "check" : "link"} class="h-4 w-4" />
        {recoveryCopied
          ? m.common_copied()
          : m.settings_mfa_recovery_copy_all()}
      </button>
      <button class="btn btn-primary w-full" onclick={closeModal}>
        {m.settings_mfa_recovery_acknowledge()}
      </button>
    </div>
  </Modal>
{/if}

<style>
  .qr-frame :global(svg) {
    width: 200px;
    height: 200px;
  }
</style>
