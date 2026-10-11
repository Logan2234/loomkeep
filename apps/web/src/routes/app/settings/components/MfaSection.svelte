<script lang="ts">
  import RecoveryCodesModal from "./RecoveryCodesModal.svelte";
  import MfaTotpSetupModal from "./MfaTotpSetupModal.svelte";
  import PasswordConfirmModal from "./PasswordConfirmModal.svelte";

  import { WEBAUTHN_NAME_MAX_LENGTH } from "@loomkeep/shared";

  import {
    confirmTotp,
    disableTotp,
    getMfaStatus,
    regenerateRecoveryCodes,
    registerWebauthnCredential,
    removeWebauthnCredential,
    renameWebauthnCredential,
    setEmailMfa,
    setPasswordless,
    setupTotp,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import CardRowSkeleton from "#lib/components/CardRowSkeleton.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";

  import Switch from "#lib/components/Switch.svelte";

  import { DATE_MEDIUM_OPTIONS, formatDate } from "#lib/format.js";

  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/toast.svelte.js";
  import type { MfaStatusDto, WebauthnCredentialDto } from "@loomkeep/shared";
  import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { RECOVERY_CODES_LOW_THRESHOLD } from "../nav";
  import SettingRow from "./SettingRow.svelte";

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
    | "webauthn-rename"
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
      // Loaded on demand: qrcode is only ever needed once the user opens the
      // TOTP setup modal, so it stays out of the settings route's chunk.
      const { default: QRCode } = await import("qrcode");
      const svg = await QRCode.toString(totpOtpauthUri, {
        type: "svg",
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      // The modal may have been closed while the module was loading; assigning
      // then would re-show a stale QR on the next open (openTotpSetup clears it
      // before the mutation resolves).
      if (openModal === "totp-setup") totpQrSvg = svg;
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

  let revealedCodes = $state<string[]>([]);

  function openRecoveryReveal(codes: string[]) {
    revealedCodes = codes;
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

  let pendingRenameCredential = $state<WebauthnCredentialDto | null>(null);

  const webauthnRenameMut = createApiMutation(() => ({
    mutate: (name: string) =>
      renameWebauthnCredential(pendingRenameCredential!.id, { name }),
    onSuccess: ({ credential }) => {
      patchStatus({
        webauthnCredentials: (status?.webauthnCredentials ?? []).map((c) =>
          c.id === credential.id ? credential : c,
        ),
      });
      openModal = null;
      toast.success(m.settings_mfa_webauthn_renamed_toast());
    },
  }));

  function openWebauthnRename(credential: WebauthnCredentialDto) {
    pendingRenameCredential = credential;
    webauthnNameInput = credential.name;
    webauthnRenameMut.reset();
    openModal = "webauthn-rename";
  }

  function confirmWebauthnRename() {
    const name = webauthnNameInput.trim();
    if (!name) return;
    webauthnRenameMut.mutate(name);
  }

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

  const recoveryLow = $derived(
    !!status && status.recoveryCodesRemaining <= RECOVERY_CODES_LOW_THRESHOLD,
  );
</script>

{#if statusQuery.loading}
  <CardRowSkeleton count={4} />
{:else}
  <div class="space-y-4">
    <section class="card p-5 md:p-6">
      <p class="text-dim mb-3 text-sm font-semibold">
        {m.settings_mfa_verification_methods()}
      </p>
      <div class="divide-border divide-y">
        <SettingRow
          anchor="mfa-totp"
          label={m.auth_mfa_totp_label()}
          description={m.settings_mfa_totp_desc()}
          icon="qr-code">
          {#snippet control()}
            <Switch
              label={m.auth_mfa_totp_label()}
              checked={status?.totpEnabled || false}
              onChange={(next) =>
                next ? openTotpSetup() : openTotpDisable()} />
          {/snippet}
        </SettingRow>

        <SettingRow
          anchor="mfa-email"
          label={m.auth_mfa_email_label()}
          description={m.settings_mfa_email_desc()}
          icon="mail">
          {#snippet control()}
            <Switch
              label={m.auth_mfa_email_label()}
              checked={status?.emailEnabled || false}
              onChange={onToggleEmail} />
          {/snippet}
        </SettingRow>
      </div>
    </section>

    {#if webauthnBrowserSupported}
      <section class="card p-5 md:p-6">
        <p class="text-dim mb-3 text-sm font-semibold">
          {m.settings_mfa_security_keys()}
        </p>
        <div class="divide-border divide-y">
          <SettingRow
            anchor="mfa-webauthn"
            label={m.common_security_key()}
            description={webauthnSecureContext
              ? m.settings_mfa_webauthn_desc()
              : m.settings_mfa_webauthn_unsupported()}
            icon="key">
            {#snippet control()}
              <button
                type="button"
                class="btn btn-ghost btn-sm shrink-0"
                disabled={!webauthnSecureContext}
                onclick={openWebauthnAdd}>
                <Icon name="plus" class="h-4 w-4" />
                {m.common_add()}
              </button>
            {/snippet}

            {#if status && status.webauthnCredentials.length > 0}
              <div
                class="border-border divide-border divide-y rounded-lg border border-dashed">
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
                      class="btn-icon"
                      aria-label={m.common_rename()}
                      onclick={() => openWebauthnRename(credential)}>
                      <Icon name="edit" class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={m.common_delete()}
                      class="btn-icon hover:text-danger hover:bg-danger/10"
                      onclick={() => openWebauthnRemove(credential)}>
                      <Icon name="trash" class="h-4 w-4" />
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </SettingRow>

          <SettingRow
            anchor="mfa-passwordless"
            label={m.settings_mfa_passwordless_label()}
            description={status && status.webauthnCredentials.length > 0
              ? m.settings_mfa_passwordless_desc()
              : m.settings_mfa_passwordless_needs_credential()}
            icon="lock">
            {#snippet control()}
              <Switch
                label={m.settings_mfa_passwordless_label()}
                checked={status?.passwordlessEnabled || false}
                disabled={!status || status.webauthnCredentials.length === 0}
                onChange={onTogglePasswordless} />
            {/snippet}
          </SettingRow>
        </div>
      </section>
    {/if}

    {#if hasAnyMfa && status}
      <section class="card p-5 md:p-6">
        <p class="text-dim mb-3 text-sm font-semibold">
          {m.settings_mfa_account_recovery()}
        </p>
        <SettingRow
          anchor="mfa-recovery"
          label={m.settings_mfa_recovery_title()}
          description={recoveryLow
            ? m.settings_mfa_recovery_low_warning({
                count: status.recoveryCodesRemaining,
              })
            : m.settings_mfa_recovery_hint()}
          icon={recoveryLow ? "warning" : "shield"}>
          {#snippet control()}
            <button
              class="link-accent shrink-0 text-sm"
              onclick={openRecoveryRegenerate}>
              {m.common_regenerate()}
            </button>
          {/snippet}
        </SettingRow>
      </section>
    {/if}
  </div>
{/if}

{#if openModal === "totp-setup"}
  <MfaTotpSetupModal
    bind:step={totpStep}
    bind:code={totpCodeInput}
    qrSvg={totpQrSvg}
    secret={totpSecret}
    busy={totpConfirmMut.loading}
    invalid={!!totpConfirmMut.error}
    onconfirm={confirmTotpSetup}
    onclose={closeModal} />
{/if}

{#if openModal === "totp-disable"}
  <PasswordConfirmModal
    title={m.settings_mfa_totp_disable_title()}
    description={m.settings_mfa_totp_disable_hint()}
    bind:password={disablePasswordInput}
    busy={totpDisableMut.loading}
    error={totpDisableMut.error}
    confirmLabel={m.common_disable()}
    danger
    onconfirm={confirmTotpDisable}
    onclose={closeModal} />
{/if}

{#if openModal === "email-confirm"}
  <PasswordConfirmModal
    title={m.auth_mfa_email_label()}
    description={m.settings_mfa_email_desc()}
    bind:password={sensitivePasswordInput}
    busy={emailMfaMut.loading}
    error={emailMfaMut.error}
    confirmLabel={m.common_confirm()}
    onconfirm={confirmEmailMfa}
    onclose={closeModal} />
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
          maxlength={WEBAUTHN_NAME_MAX_LENGTH}
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

{#if openModal === "webauthn-rename"}
  <Modal title={m.settings_mfa_webauthn_rename_title()} onclose={closeModal}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        confirmWebauthnRename();
      }}>
      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">
          {m.settings_mfa_webauthn_name_label()}
        </span>
        <input
          type="text"
          name="name"
          required
          maxlength={WEBAUTHN_NAME_MAX_LENGTH}
          enterkeyhint="done"
          class="input"
          bind:value={webauthnNameInput} />
      </label>
      {#if webauthnRenameMut.error}
        <p class="text-danger text-sm">{webauthnRenameMut.error}</p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" onclick={closeModal}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={webauthnRenameMut.loading || !webauthnNameInput.trim()}>
          {webauthnRenameMut.loading
            ? m.common_save_loading()
            : m.common_save()}
        </button>
      </div>
    </form>
  </Modal>
{/if}

{#if openModal === "webauthn-remove"}
  <PasswordConfirmModal
    title={m.settings_mfa_webauthn_remove_title()}
    description={m.settings_mfa_webauthn_remove_hint()}
    bind:password={sensitivePasswordInput}
    busy={webauthnRemoveMut.loading}
    error={webauthnRemoveMut.error}
    confirmLabel={m.common_delete()}
    danger
    onconfirm={confirmWebauthnRemove}
    onclose={closeModal} />
{/if}

{#if openModal === "passwordless-confirm"}
  <PasswordConfirmModal
    title={m.settings_mfa_passwordless_label()}
    description={m.settings_mfa_passwordless_confirm_hint()}
    bind:password={sensitivePasswordInput}
    busy={passwordlessMut.loading}
    error={passwordlessMut.error}
    confirmLabel={m.common_confirm()}
    onconfirm={confirmPasswordless}
    onclose={closeModal} />
{/if}

{#if openModal === "recovery-regenerate-confirm"}
  <PasswordConfirmModal
    title={m.settings_mfa_recovery_regenerate_confirm_title()}
    description={m.settings_mfa_recovery_regenerate_confirm_message()}
    bind:password={sensitivePasswordInput}
    busy={regenerateMut.loading}
    error={regenerateMut.error}
    confirmLabel={m.common_regenerate()}
    danger
    onconfirm={confirmRegenerate}
    onclose={closeModal} />
{/if}

{#if openModal === "recovery-reveal"}
  <RecoveryCodesModal
    codes={revealedCodes}
    accountEmail={auth.user?.email ?? ""}
    onclose={closeModal} />
{/if}
