<script lang="ts">
  import {
    confirmTotp,
    disableTotp,
    getMfaStatus,
    regenerateRecoveryCodes,
    registerWebauthnCredential,
    removeWebauthnCredential,
    setEmailMfa,
    setPasswordless,
    setupTotp,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { DATE_MEDIUM_OPTIONS, formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import type { MfaStatusDto, WebauthnCredentialDto } from "@loomkeep/shared";
  import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
  import { useQueryClient } from "@tanstack/svelte-query";
  import QRCode from "qrcode";

  const RECOVERY_CODES_LOW_THRESHOLD = 2;

  // WebAuthn additionally needs a secure context (HTTPS, or localhost) — a
  // self-host without TLS in front (docker-compose.yml's bare default, no
  // Caddy) fails that even when the browser itself supports the API.
  const webauthnBrowserSupported = browserSupportsWebAuthn();
  const webauthnSecureContext =
    typeof window !== "undefined" && window.isSecureContext;

  type MfaModal =
    | "totp-setup"
    | "totp-disable"
    | "email-confirm"
    | "recovery-regenerate-confirm"
    | "recovery-reveal"
    | "webauthn-add"
    | "webauthn-remove"
    | "passwordless-confirm"
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
  let sensitivePasswordInput = $state("");
  let pendingEmailEnabled = $state(false);

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

  const emailMfaMut = createApiMutation(() => ({
    mutate: (input: { enabled: boolean; currentPassword: string }) =>
      setEmailMfa(input),
    coveredFields: ["currentPassword"],
    errorToast: true,
    onSuccess: ({ recoveryCodes }, input) => {
      patchStatus({ emailEnabled: input.enabled });
      sensitivePasswordInput = "";
      if (recoveryCodes) {
        openRecoveryReveal(recoveryCodes);
      } else {
        openModal = null;
      }
    },
  }));

  function onToggleEmail(next: boolean) {
    pendingEmailEnabled = next;
    sensitivePasswordInput = "";
    emailMfaMut.reset();
    openModal = "email-confirm";
  }

  function confirmEmailMfa() {
    emailMfaMut.mutate({
      enabled: pendingEmailEnabled,
      currentPassword: sensitivePasswordInput,
    });
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
      sensitivePasswordInput = "";
      openRecoveryReveal(codes);
    },
  }));

  function openRecoveryRegenerate() {
    sensitivePasswordInput = "";
    regenerateMut.reset();
    openModal = "recovery-regenerate-confirm";
  }

  function confirmRegenerate() {
    regenerateMut.mutate({ currentPassword: sensitivePasswordInput });
  }

  async function copyAllCodes() {
    await navigator.clipboard.writeText(revealedCodes.join("\n"));
    recoveryCopied = true;
    setTimeout(() => (recoveryCopied = false), 2000);
  }

  const groupCode = (code: string): string =>
    `${code.slice(0, 5)}-${code.slice(5)}`;

  // --- WebAuthn credentials ---
  let webauthnNameInput = $state("");
  let pendingRemoveCredential = $state<WebauthnCredentialDto | null>(null);

  const webauthnAddMut = createApiMutation(() => ({
    mutate: (name: string) => registerWebauthnCredential(name),
    onSuccess: ({ credential, recoveryCodes }) => {
      patchStatus({
        webauthnCredentials: [
          ...(status?.webauthnCredentials ?? []),
          credential,
        ],
      });
      if (recoveryCodes) {
        openRecoveryReveal(recoveryCodes);
      } else {
        openModal = null;
        toast.success(m.settings_mfa_webauthn_added_toast());
      }
    },
  }));

  function openWebauthnAdd() {
    webauthnNameInput = "";
    webauthnAddMut.reset();
    openModal = "webauthn-add";
  }

  function confirmWebauthnAdd() {
    webauthnAddMut.mutate(webauthnNameInput.trim());
  }

  const webauthnRemoveMut = createApiMutation(() => ({
    mutate: () =>
      removeWebauthnCredential(pendingRemoveCredential!.id, {
        currentPassword: sensitivePasswordInput,
      }),
    coveredFields: ["currentPassword"],
    onSuccess: (result) => {
      patchStatus({
        webauthnCredentials: (status?.webauthnCredentials ?? []).filter(
          (c) => c.id !== pendingRemoveCredential?.id,
        ),
        ...(result.passwordlessDisabled ? { passwordlessEnabled: false } : {}),
      });
      sensitivePasswordInput = "";
      openModal = null;
      toast.success(
        result.passwordlessDisabled
          ? m.settings_mfa_webauthn_removed_passwordless_disabled_toast()
          : m.settings_mfa_webauthn_removed_toast(),
      );
    },
  }));

  function openWebauthnRemove(credential: WebauthnCredentialDto) {
    pendingRemoveCredential = credential;
    sensitivePasswordInput = "";
    webauthnRemoveMut.reset();
    openModal = "webauthn-remove";
  }

  function confirmWebauthnRemove() {
    webauthnRemoveMut.mutate();
  }

  // --- Passwordless sign-in ---
  let pendingPasswordlessEnabled = $state(false);

  const passwordlessMut = createApiMutation(() => ({
    mutate: () =>
      setPasswordless({
        enabled: pendingPasswordlessEnabled,
        currentPassword: sensitivePasswordInput,
      }),
    coveredFields: ["currentPassword"],
    onSuccess: () => {
      patchStatus({ passwordlessEnabled: pendingPasswordlessEnabled });
      sensitivePasswordInput = "";
      openModal = null;
      toast.success(
        pendingPasswordlessEnabled
          ? m.settings_mfa_passwordless_enabled_toast()
          : m.settings_mfa_passwordless_disabled_toast(),
      );
    },
  }));

  function onTogglePasswordless(next: boolean) {
    pendingPasswordlessEnabled = next;
    sensitivePasswordInput = "";
    passwordlessMut.reset();
    openModal = "passwordless-confirm";
  }

  function confirmPasswordless() {
    passwordlessMut.mutate();
  }

  function closeModal() {
    sensitivePasswordInput = "";
    openModal = null;
  }

  const hasAnyMfa = $derived(
    !!status &&
      (status.totpEnabled ||
        status.emailEnabled ||
        status.webauthnCredentials.length > 0),
  );
</script>

<section class="card mb-5 p-5 md:p-6">
  <h2 class="font-display mb-4 flex items-center gap-2 text-lg font-bold">
    {m.settings_section_mfa()}
    {#if isFeatureNew("mfa")}<NewBadge />{/if}
  </h2>

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
        checked={status?.totpEnabled || false}
        onChange={(next) => (next ? openTotpSetup() : openTotpDisable())} />
    </div>

    <div class="flex items-center justify-between gap-4 py-3">
      <div class="flex items-start gap-3">
        <Icon name="mail" class="text-dim mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p class="font-semibold">{m.auth_mfa_email_label()}</p>
          <p class="text-dim text-sm">{m.settings_mfa_email_desc()}</p>
        </div>
      </div>
      <Switch
        label={m.auth_mfa_email_label()}
        checked={status?.emailEnabled || false}
        onChange={onToggleEmail} />
    </div>

    {#if webauthnBrowserSupported}
      <div class="py-3">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <Icon name="key" class="text-dim mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p class="font-semibold">{m.settings_mfa_webauthn_label()}</p>
              <p class="text-dim text-sm">
                {webauthnSecureContext
                  ? m.settings_mfa_webauthn_desc()
                  : m.settings_mfa_webauthn_unsupported()}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm shrink-0"
            disabled={!webauthnSecureContext}
            onclick={openWebauthnAdd}>
            <Icon name="plus" class="h-4 w-4" />
            {m.common_add()}
          </button>
        </div>

        {#if status && status.webauthnCredentials.length > 0}
          <div
            class="border-border divide-border mt-3 divide-y rounded-lg border border-dashed">
            {#each status.webauthnCredentials as credential (credential.id)}
              <div class="flex items-center gap-3 px-3 py-2.5">
                <span
                  class="bg-surface-2 text-dim grid h-8 w-8 shrink-0 place-items-center rounded-lg">
                  <Icon name="key" class="h-4 w-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">
                    {credential.name}
                  </p>
                  <p
                    class="text-dim font-mono text-[0.68rem] tracking-wide uppercase">
                    {credential.lastUsedAt
                      ? m.settings_mfa_webauthn_used_at({
                          date: formatDate(
                            credential.lastUsedAt,
                            DATE_MEDIUM_OPTIONS,
                          ),
                        })
                      : m.settings_mfa_webauthn_added_at({
                          date: formatDate(
                            credential.createdAt,
                            DATE_MEDIUM_OPTIONS,
                          ),
                        })}
                  </p>
                </div>
                <button
                  type="button"
                  class="btn-icon shrink-0"
                  aria-label={m.common_delete()}
                  onclick={() => openWebauthnRemove(credential)}>
                  <Icon name="trash" class="h-4 w-4" />
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div
        class="flex items-center justify-between gap-4 {hasAnyMfa
          ? 'py-3'
          : 'pt-3'}">
        <div class="flex items-start gap-3">
          <Icon name="lock" class="text-dim mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p class="font-semibold">{m.settings_mfa_passwordless_label()}</p>
            <p class="text-dim text-sm">
              {status && status.webauthnCredentials.length > 0
                ? m.settings_mfa_passwordless_desc()
                : m.settings_mfa_passwordless_needs_credential()}
            </p>
          </div>
        </div>
        <Switch
          label={m.settings_mfa_passwordless_label()}
          checked={status?.passwordlessEnabled || false}
          disabled={!status || status.webauthnCredentials.length === 0}
          onChange={onTogglePasswordless} />
      </div>
    {/if}

    {#if hasAnyMfa}
      <div class="flex items-center justify-between gap-4 pt-3">
        <div>
          <p class="font-semibold">
            {m.settings_mfa_recovery_title()}

            {#if status && status.recoveryCodesRemaining <= RECOVERY_CODES_LOW_THRESHOLD}
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
          onclick={openRecoveryRegenerate}>
          {m.common_regenerate()}
        </button>
      </div>
    {/if}
  </div>
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
            name="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            minlength="6"
            maxlength="6"
            required
            enterkeyhint="done"
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
          name="currentPassword"
          autocomplete="current-password"
          enterkeyhint="done"
          minlength={1}
          required
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

{#if openModal === "email-confirm"}
  <Modal title={m.auth_mfa_email_label()} onclose={closeModal}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        confirmEmailMfa();
      }}>
      <p class="text-sm">{m.settings_mfa_email_desc()}</p>
      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">
          {m.common_current_password()}
        </span>
        <PasswordInput
          name="currentPassword"
          autocomplete="current-password"
          enterkeyhint="done"
          minlength={1}
          required
          bind:value={sensitivePasswordInput} />
      </label>
      {#if emailMfaMut.error}
        <p class="text-danger text-sm">{emailMfaMut.error}</p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" onclick={closeModal}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={emailMfaMut.loading || !sensitivePasswordInput}>
          {emailMfaMut.loading ? m.common_save_loading() : m.common_confirm()}
        </button>
      </div>
    </form>
  </Modal>
{/if}

{#if openModal === "webauthn-add"}
  <Modal title={m.settings_mfa_webauthn_name_title()} onclose={closeModal}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        confirmWebauthnAdd();
      }}>
      <p class="text-sm">{m.settings_mfa_webauthn_name_hint()}</p>
      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">
          {m.settings_mfa_webauthn_name_label()}
        </span>
        <input
          type="text"
          name="name"
          required
          maxlength="60"
          enterkeyhint="done"
          class="input"
          bind:value={webauthnNameInput} />
      </label>
      {#if webauthnAddMut.error}
        <p class="text-danger text-sm">{webauthnAddMut.error}</p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" onclick={closeModal}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={webauthnAddMut.loading || !webauthnNameInput.trim()}>
          {webauthnAddMut.loading ? m.common_save_loading() : m.common_next()}
        </button>
      </div>
    </form>
  </Modal>
{/if}

{#if openModal === "webauthn-remove"}
  <Modal title={m.settings_mfa_webauthn_remove_title()} onclose={closeModal}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        confirmWebauthnRemove();
      }}>
      <p class="text-sm">{m.settings_mfa_webauthn_remove_hint()}</p>
      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">
          {m.common_current_password()}
        </span>
        <PasswordInput
          name="currentPassword"
          autocomplete="current-password"
          enterkeyhint="done"
          minlength={1}
          required
          bind:value={sensitivePasswordInput} />
      </label>
      {#if webauthnRemoveMut.error}
        <p class="text-danger text-sm">{webauthnRemoveMut.error}</p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" onclick={closeModal}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-danger"
          disabled={webauthnRemoveMut.loading || !sensitivePasswordInput}>
          {webauthnRemoveMut.loading
            ? m.common_save_loading()
            : m.common_delete()}
        </button>
      </div>
    </form>
  </Modal>
{/if}

{#if openModal === "passwordless-confirm"}
  <Modal title={m.settings_mfa_passwordless_label()} onclose={closeModal}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        confirmPasswordless();
      }}>
      <p class="text-sm">{m.settings_mfa_passwordless_confirm_hint()}</p>
      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">
          {m.common_current_password()}
        </span>
        <PasswordInput
          name="currentPassword"
          autocomplete="current-password"
          enterkeyhint="done"
          minlength={1}
          required
          bind:value={sensitivePasswordInput} />
      </label>
      {#if passwordlessMut.error}
        <p class="text-danger text-sm">{passwordlessMut.error}</p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" onclick={closeModal}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={passwordlessMut.loading || !sensitivePasswordInput}>
          {passwordlessMut.loading
            ? m.common_save_loading()
            : m.common_confirm()}
        </button>
      </div>
    </form>
  </Modal>
{/if}

{#if openModal === "recovery-regenerate-confirm"}
  <Modal
    title={m.settings_mfa_recovery_regenerate_confirm_title()}
    onclose={closeModal}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        confirmRegenerate();
      }}>
      <p class="text-sm">
        {m.settings_mfa_recovery_regenerate_confirm_message()}
      </p>
      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">
          {m.common_current_password()}
        </span>
        <PasswordInput
          name="currentPassword"
          autocomplete="current-password"
          enterkeyhint="done"
          minlength={1}
          required
          bind:value={sensitivePasswordInput} />
      </label>
      {#if regenerateMut.error}
        <p class="text-danger text-sm">{regenerateMut.error}</p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" onclick={closeModal}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-danger"
          disabled={regenerateMut.loading || !sensitivePasswordInput}>
          {regenerateMut.loading
            ? m.common_save_loading()
            : m.common_regenerate()}
        </button>
      </div>
    </form>
  </Modal>
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
