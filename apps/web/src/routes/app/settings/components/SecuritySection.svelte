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
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import PasswordRequirements from "$lib/components/PasswordRequirements.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import { isPasswordValid } from "@loomkeep/shared";

  type SecurityModal = "username" | "email" | "password" | null;

  let openModal = $state<SecurityModal>(null);
  let verificationCooldown = $state(0);
  let verificationCooldownTimer: ReturnType<typeof setInterval> | undefined;

  function closeModal() {
    clearTimeout(usernameCheckTimer);
    openModal = null;
  }

  let usernameInput = $state("");
  type UsernameCheck = "idle" | "checking" | "available" | "taken" | "error";
  let usernameCheck = $state<UsernameCheck>("idle");
  let usernameCheckTimer: ReturnType<typeof setTimeout> | undefined;

  function openUsernameModal() {
    usernameInput = auth.user?.username ?? "";
    saveUsernameMut.reset();
    usernameCheck = "idle";
    openModal = "username";
  }

  // Debounced availability check, keyed on the current input value so a slow
  // response can never clobber the status of a value the user has since edited.
  function onUsernameInput() {
    clearTimeout(usernameCheckTimer);
    const value = usernameInput.trim();
    if (!value || value === auth.user?.username) {
      usernameCheck = "idle";
      return;
    }
    usernameCheck = "checking";
    usernameCheckTimer = setTimeout(async () => {
      try {
        const { available } = await checkUsernameAvailable(value);
        if (usernameInput.trim() === value) {
          usernameCheck = available ? "available" : "taken";
        }
      } catch {
        if (usernameInput.trim() === value) usernameCheck = "error";
      }
    }, 400);
  }

  const saveUsernameMut = createApiMutation(() => ({
    mutate: () => updateUsername({ username: usernameInput.trim() }),
    coveredFields: ["username"],
    onSuccess: () => {
      openModal = null;
      toast.success("Nom d'utilisateur mis à jour.");
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
      emailAlreadyCurrentError = "C'est déjà ton adresse email actuelle.";
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
      toast.success("Email mis à jour.");
    },
  }));

  function confirmEmail() {
    confirmEmailMut.mutate();
  }

  const resendVerificationMut = createApiMutation(() => ({
    mutate: resendVerificationEmail,
    errorToast: true,
    onSuccess: () => {
      verificationCooldown = 60;
      clearInterval(verificationCooldownTimer);
      verificationCooldownTimer = setInterval(() => {
        verificationCooldown -= 1;
        if (verificationCooldown <= 0) {
          clearInterval(verificationCooldownTimer);
          verificationCooldownTimer = undefined;
        }
      }, 1000);
    },
  }));

  function resendVerification() {
    if (
      resendVerificationMut.loading ||
      verificationCooldown > 0 ||
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
      toast.success("Mot de passe mis à jour.");
    },
  }));

  function savePassword() {
    localPasswordError = "";
    if (!isPasswordValid(newPasswordInput)) {
      localPasswordError =
        "Le nouveau mot de passe ne respecte pas les exigences ci-dessus.";
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      localPasswordError = "Les mots de passe ne correspondent pas.";
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
        <button class="link-accent text-sm" onclick={openUsernameModal}>
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
                title="Adresse email vérifiée">
                <Icon name="check" class="h-4 w-4" />
              </span>
              <span class="sr-only">Adresse email vérifiée</span>
            {:else}
              <span
                class="text-warning shrink-0"
                aria-hidden="true"
                title="Adresse email non vérifiée">
                <Icon name="warning" class="h-4 w-4" />
              </span>
              <span class="sr-only">Adresse email non vérifiée</span>
            {/if}
          </p>

          {#if !auth.user.emailVerified}
            <div
              class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <button
                type="button"
                class="link-accent"
                onclick={resendVerification}
                disabled={resendVerificationMut.loading ||
                  verificationCooldown > 0}>
                {#if resendVerificationMut.loading}
                  {m.common_sending()}
                {:else if verificationCooldown > 0}
                  {m.common_resend_cooldown({ seconds: verificationCooldown })}
                {:else}
                  Renvoyer l'email de vérification
                {/if}
              </button>
            </div>

            {#if verificationSent}
              <p class="text-success mt-1 text-xs">
                <Icon name="check" class="inline h-4 w-4" /> Email envoyé
              </p>
            {/if}
          {/if}
        </div>

        <button class="link-accent shrink-0 text-sm" onclick={openEmailModal}>
          {m.common_edit()}
        </button>
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div>
          <p class="text-dim text-sm">{m.common_password()}</p>
          <p class="font-semibold tracking-widest">••••••••</p>
        </div>
        <button class="link-accent text-sm" onclick={openPasswordModal}>
          {m.common_edit()}
        </button>
      </div>
      <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
        <div>
          <p class="text-dim text-sm">Appareils connectés</p>
          <p class="font-semibold">Sessions ouvertes sur ton compte</p>
        </div>
        <a href="/app/settings/sessions" class="link-accent text-sm">
          {m.common_manage()}
        </a>
      </div>
    </div>
  </section>

  {#if openModal === "username"}
    <Modal title="Changer le nom d'utilisateur" onclose={closeModal}>
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
            class="input"
            maxlength="50"
            bind:value={usernameInput}
            oninput={onUsernameInput} />
        </label>
        {#if usernameCheck === "checking"}
          <p class="text-dim text-sm">{m.common_verifying()}</p>
        {:else if usernameCheck === "available"}
          <p class="text-success flex items-center gap-1.5 text-sm">
            <Icon name="check" class="h-4 w-4" />
            Ce nom d'utilisateur est disponible.
          </p>
        {:else if usernameCheck === "taken"}
          <p class="text-danger flex items-center gap-1.5 text-sm">
            <Icon name="warning" class="h-4 w-4" />
            Ce nom d'utilisateur est déjà utilisé par quelqu'un d'autre.
          </p>
        {:else if usernameCheck === "error"}
          <p class="text-danger flex items-center gap-1.5 text-sm">
            <Icon name="warning" class="h-4 w-4" />
            Impossible de vérifier la disponibilité, réessaie.
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
    <Modal title="Changer l'email" onclose={closeModal}>
      {#if emailStep === "form"}
        <form
          class="flex flex-col gap-3"
          onsubmit={(e) => {
            e.preventDefault();
            saveEmail();
          }}>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold">Nouvel email</span>
            <input
              type="email"
              class="input"
              placeholder={auth.user?.email}
              bind:value={emailInput} />
            <p class="text-dim mt-1.5 text-xs">
              Un email de vérification te sera envoyé à l'adresse renseignée.
            </p>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold">
              Mot de passe actuel
            </span>
            <PasswordInput
              autocomplete="current-password"
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
            Un code de confirmation a été envoyé à <strong>{emailInput}</strong
            >.
          </p>
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold"
              >{m.common_code()}</span>
            <input
              type="text"
              inputmode="numeric"
              maxlength="6"
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
    <Modal title="Changer le mot de passe" onclose={closeModal}>
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => {
          e.preventDefault();
          savePassword();
        }}>
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">
            Mot de passe actuel
          </span>
          <PasswordInput
            autocomplete="current-password"
            bind:value={currentPasswordInput} />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">
            {m.common_new_password()}
          </span>
          <PasswordInput
            autocomplete="new-password"
            minlength={8}
            bind:value={newPasswordInput} />
          <div class="mt-2">
            <PasswordRequirements value={newPasswordInput} />
          </div>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">
            Confirmer le nouveau mot de passe
          </span>
          <PasswordInput
            autocomplete="new-password"
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
