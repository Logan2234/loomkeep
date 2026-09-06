<script lang="ts">
  import {
    changeEmail,
    changePassword,
    checkUsernameAvailable,
    confirmEmailChange,
    resendVerificationEmail,
    updateUsername,
  } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import { Cooldown } from "$lib/cooldown.svelte";
  import { debounce } from "$lib/debounce";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import PasswordRequirements from "$lib/components/PasswordRequirements.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import { isPasswordValid } from "@loomkeep/shared";

  type SecurityModal = "username" | "email" | "password" | null;

  let openModal = $state<SecurityModal>(null);
  const verificationCooldown = new Cooldown();

  function closeModal() {
    checkUsernameAvailability.cancel();
    openModal = null;
  }

  let usernameInput = $state("");
  type UsernameCheck = "idle" | "checking" | "available" | "taken" | "error";
  let usernameCheck = $state<UsernameCheck>("idle");

  function openUsernameModal() {
    usernameInput = auth.user?.username ?? "";
    saveUsernameMut.reset();
    usernameCheck = "idle";
    openModal = "username";
  }

  // Debounced availability check, keyed on the current input value so a slow
  // response can never clobber the status of a value the user has since edited.
  const checkUsernameAvailability = debounce(async (value: string) => {
    try {
      const { available } = await checkUsernameAvailable(value);
      if (usernameInput.trim() === value) {
        usernameCheck = available ? "available" : "taken";
      }
    } catch {
      if (usernameInput.trim() === value) usernameCheck = "error";
    }
  }, 400);

  function onUsernameInput() {
    const value = usernameInput.trim();
    if (!value || value === auth.user?.username) {
      usernameCheck = "idle";
      checkUsernameAvailability.cancel();
      return;
    }
    usernameCheck = "checking";
    checkUsernameAvailability.call(value);
  }

  const saveUsernameMut = createApiMutation(() => ({
    mutate: () => updateUsername({ username: usernameInput.trim() }),
    coveredFields: ["username"],
    onSuccess: () => {
      openModal = null;
      toast.success(m.settings_username_updated());
    },
  }));

  function saveUsername() {
    if (usernameCheck !== "available") return;
    saveUsernameMut.mutate();
  }

  let emailInput = $state("");
  let emailPasswordInput = $state("");
  let emailAlreadyCurrentError = $state("");
  let emailStep: "form" | "code" = $state("form");
  let emailCodeInput = $state("");

  function openEmailModal() {
    emailInput = "";
    emailPasswordInput = "";
    emailAlreadyCurrentError = "";
    saveEmailMut.reset();
    emailStep = "form";
    emailCodeInput = "";
    confirmEmailMut.reset();
    openModal = "email";
  }

  const saveEmailMut = createApiMutation(() => ({
    mutate: () =>
      changeEmail({
        newEmail: emailInput.trim(),
        currentPassword: emailPasswordInput,
      }),
    coveredFields: ["newEmail", "currentPassword"],
    onSuccess: () => (emailStep = "code"),
  }));

  function saveEmail() {
    emailAlreadyCurrentError = "";
    if (emailInput.trim() === auth.user?.email) {
      emailAlreadyCurrentError = m.settings_email_already_current();
      return;
    }
    saveEmailMut.mutate();
  }

  const emailError = $derived(emailAlreadyCurrentError || saveEmailMut.error);

  const confirmEmailMut = createApiMutation(() => ({
    mutate: () => confirmEmailChange({ code: emailCodeInput.trim() }),
    coveredFields: ["code"],
    onSuccess: () => {
      openModal = null;
      toast.success(m.settings_email_updated());
    },
  }));

  function confirmEmail() {
    confirmEmailMut.mutate();
  }

  const resendVerificationMut = createApiMutation(() => ({
    mutate: resendVerificationEmail,
    errorToast: true,
    onSuccess: () => verificationCooldown.start(60),
  }));

  function resendVerification() {
    if (
      resendVerificationMut.loading ||
      verificationCooldown.remaining > 0 ||
      auth.user?.emailVerified
    ) {
      return;
    }
    resendVerificationMut.mutate();
  }

  const verificationSent = $derived(!!resendVerificationMut.data);

  let currentPasswordInput = $state("");
  let newPasswordInput = $state("");
  let confirmPasswordInput = $state("");
  let localPasswordError = $state("");

  function openPasswordModal() {
    currentPasswordInput = "";
    newPasswordInput = "";
    confirmPasswordInput = "";
    localPasswordError = "";
    savePasswordMut.reset();
    openModal = "password";
  }

  const savePasswordMut = createApiMutation(() => ({
    mutate: () =>
      changePassword({
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput,
      }),
    coveredFields: ["currentPassword"],
    onSuccess: () => {
      openModal = null;
      toast.success(m.settings_password_updated());
    },
  }));

  function savePassword() {
    localPasswordError = "";
    if (!isPasswordValid(newPasswordInput)) {
      localPasswordError = m.settings_password_invalid();
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      localPasswordError = m.settings_passwords_mismatch();
      return;
    }
    savePasswordMut.mutate();
  }

  const passwordError = $derived(localPasswordError || savePasswordMut.error);
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-4 text-lg font-bold">{m.common_security()}</h2>
    <div class="divide-border divide-y">
      <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
        <div>
          <p class="text-dim text-sm">{m.common_username()}</p>
          <p class="font-semibold">{auth.user.username}</p>
        </div>
        <button
          class="btn-text btn-text-underline text-accent hover:text-accent text-sm"
          onclick={openUsernameModal}>
          {m.common_edit()}
        </button>
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div class="min-w-0">
          <p class="text-dim text-sm">{m.common_email()}</p>
          <p class="flex items-center gap-1.5 font-semibold">
            <span class="truncate">{auth.user.email}</span>
            {#if auth.user.emailVerified}
              <span
                class="text-success shrink-0"
                aria-hidden="true"
                title={m.settings_email_verified()}>
                <Icon name="check" class="h-4 w-4" />
              </span>
              <span class="sr-only">{m.settings_email_verified()}</span>
            {:else}
              <span
                class="text-warning shrink-0"
                aria-hidden="true"
                title={m.settings_email_not_verified()}>
                <Icon name="warning" class="h-4 w-4" />
              </span>
              <span class="sr-only">{m.settings_email_not_verified()}</span>
            {/if}
          </p>

          {#if !auth.user.emailVerified}
            <div
              class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <button
                type="button"
                class="btn-text btn-text-underline text-accent hover:text-accent decoration-1"
                onclick={resendVerification}
                disabled={resendVerificationMut.loading ||
                  verificationCooldown.remaining > 0}>
                {#if resendVerificationMut.loading}
                  {m.common_sending()}
                {:else if verificationCooldown.remaining > 0}
                  {m.common_resend_cooldown({
                    seconds: verificationCooldown.remaining,
                  })}
                {:else}
                  {m.settings_resend_verification_email()}
                {/if}
              </button>
            </div>

            {#if verificationSent}
              <p class="text-success mt-1 text-xs">
                <Icon name="check" class="inline h-4 w-4" />
                {m.settings_verification_email_sent()}
              </p>
            {/if}
          {/if}
        </div>

        <button
          class="btn-text btn-text-underline text-accent hover:text-accent text-sm"
          onclick={openEmailModal}>
          {m.common_edit()}
        </button>
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div>
          <p class="text-dim text-sm">{m.common_password()}</p>
          <p class="font-semibold tracking-widest">••••••••</p>
        </div>
        <button
          class="btn-text btn-text-underline text-accent hover:text-accent text-sm"
          onclick={openPasswordModal}>
          {m.common_edit()}
        </button>
      </div>
      <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
        <div>
          <p class="text-dim text-sm">{m.settings_sessions_title()}</p>
          <p class="font-semibold">{m.settings_open_sessions_description()}</p>
        </div>
        <a
          class="btn-text btn-text-underline text-accent hover:text-accent text-sm"
          href="/app/settings/sessions">
          {m.common_manage()}
        </a>
      </div>
    </div>
  </section>

  {#if openModal === "username"}
    <Modal title={m.settings_change_username_title()} onclose={closeModal}>
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => {
          e.preventDefault();
          saveUsername();
        }}>
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">
            {m.common_username()}
          </span>
          <input
            type="text"
            name="username"
            class="input"
            minlength="1"
            maxlength="50"
            autocomplete="username"
            required
            bind:value={usernameInput}
            oninput={onUsernameInput} />
        </label>
        {#if usernameCheck === "checking"}
          <p class="text-dim text-sm">{m.common_verifying()}</p>
        {:else if usernameCheck === "available"}
          <p class="text-success flex items-center gap-1.5 text-sm">
            <Icon name="check" class="h-4 w-4" />
            {m.settings_username_available()}
          </p>
        {:else if usernameCheck === "taken"}
          <p class="text-danger flex items-center gap-1.5 text-sm">
            <Icon name="warning" class="h-4 w-4" />
            {m.settings_username_taken()}
          </p>
        {:else if usernameCheck === "error"}
          <p class="text-danger flex items-center gap-1.5 text-sm">
            <Icon name="warning" class="h-4 w-4" />
            {m.settings_username_check_error()}
          </p>
        {/if}
        {#if saveUsernameMut.error}
          <p class="text-danger text-sm">{saveUsernameMut.error}</p>
        {/if}
        <div class="mt-2 flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" onclick={closeModal}>
            {m.common_cancel()}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={saveUsernameMut.loading || usernameCheck !== "available"}>
            {saveUsernameMut.loading
              ? m.common_save_loading()
              : m.common_save()}
          </button>
        </div>
      </form>
    </Modal>
  {/if}

  {#if openModal === "email"}
    <Modal title={m.settings_change_email_title()} onclose={closeModal}>
      {#if emailStep === "form"}
        <form
          class="flex flex-col gap-3"
          onsubmit={(e) => {
            e.preventDefault();
            saveEmail();
          }}>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold"
              >{m.settings_new_email_label()}</span>
            <input
              type="email"
              name="email"
              class="input"
              autocomplete="email"
              required
              placeholder={auth.user?.email}
              bind:value={emailInput} />
            <p class="text-dim mt-1.5 text-xs">
              {m.settings_email_verification_desc()}
            </p>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold">
              {m.common_current_password()}
            </span>
            <PasswordInput
              name="currentPassword"
              autocomplete="current-password"
              enterkeyhint="next"
              minlength={1}
              required
              bind:value={emailPasswordInput} />
          </label>
          {#if emailError}
            <p class="text-danger text-sm">{emailError}</p>
          {/if}
          <div class="mt-2 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost" onclick={closeModal}>
              {m.common_cancel()}
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={saveEmailMut.loading ||
                !emailInput.trim() ||
                emailInput.trim() === auth.user?.email ||
                !emailPasswordInput}>
              {saveEmailMut.loading ? m.common_save_loading() : m.common_save()}
            </button>
          </div>
        </form>
      {:else}
        <form
          class="flex flex-col gap-3"
          onsubmit={(e) => {
            e.preventDefault();
            confirmEmail();
          }}>
          <p class="text-sm">
            {m.settings_confirmation_sent()} <strong>{emailInput}</strong>.
          </p>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold"
              >{m.common_code()}</span>
            <input
              type="text"
              name="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              minlength="6"
              maxlength="6"
              required
              enterkeyhint="done"
              class="input"
              placeholder="123456"
              bind:value={emailCodeInput} />
          </label>
          {#if confirmEmailMut.error}
            <p class="text-danger text-sm">{confirmEmailMut.error}</p>
          {/if}
          <div class="mt-2 flex justify-end gap-2">
            <button
              type="button"
              class="btn btn-ghost"
              onclick={() => (emailStep = "form")}>
              {m.common_back()}
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={confirmEmailMut.loading ||
                emailCodeInput.trim().length !== 6}>
              {confirmEmailMut.loading
                ? m.common_verifying()
                : m.common_confirm()}
            </button>
          </div>
        </form>
      {/if}
    </Modal>
  {/if}

  {#if openModal === "password"}
    <Modal title={m.settings_change_password_title()} onclose={closeModal}>
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => {
          e.preventDefault();
          savePassword();
        }}>
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">
            {m.common_current_password()}
          </span>
          <PasswordInput
            name="currentPassword"
            autocomplete="current-password"
            enterkeyhint="next"
            minlength={1}
            required
            bind:value={currentPasswordInput} />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">
            {m.common_new_password()}
          </span>
          <PasswordInput
            name="newPassword"
            autocomplete="new-password"
            enterkeyhint="next"
            minlength={8}
            maxlength={72}
            required
            bind:value={newPasswordInput} />
          <div class="mt-2">
            <PasswordRequirements value={newPasswordInput} />
          </div>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">
            {m.settings_confirm_password_label()}
          </span>
          <PasswordInput
            name="confirmPassword"
            autocomplete="new-password"
            enterkeyhint="done"
            minlength={8}
            maxlength={72}
            required
            bind:value={confirmPasswordInput} />
        </label>
        {#if passwordError}
          <p class="text-danger text-sm">{passwordError}</p>
        {/if}
        <div class="mt-2 flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" onclick={closeModal}>
            {m.common_cancel()}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={savePasswordMut.loading ||
              !currentPasswordInput ||
              !isPasswordValid(newPasswordInput) ||
              !confirmPasswordInput}>
            {savePasswordMut.loading
              ? m.common_save_loading()
              : m.common_save()}
          </button>
        </div>
      </form>
    </Modal>
  {/if}
{/if}
