<script lang="ts">
  import {
    ApiError,
    changeEmail,
    changePassword,
    checkUsernameAvailable,
    confirmEmailChange,
    updateUsername,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";

  type SecurityModal = "username" | "email" | "password" | null;

  let openModal = $state<SecurityModal>(null);

  function closeModal() {
    clearTimeout(usernameCheckTimer);
    openModal = null;
  }

  let usernameInput = $state("");
  let usernameError = $state("");
  let usernameSaving = $state(false);
  type UsernameCheck = "idle" | "checking" | "available" | "taken" | "error";
  let usernameCheck = $state<UsernameCheck>("idle");
  let usernameCheckTimer: ReturnType<typeof setTimeout> | undefined;

  function openUsernameModal() {
    usernameInput = auth.user?.username ?? "";
    usernameError = "";
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

  async function saveUsername() {
    if (usernameCheck !== "available") return;
    usernameError = "";
    usernameSaving = true;
    try {
      await updateUsername({ username: usernameInput.trim() });
      openModal = null;
      toast.success("Nom d'utilisateur mis à jour.");
    } catch (err) {
      usernameError =
        err instanceof ApiError ? err.message : m.common_save_error_fallback();
    } finally {
      usernameSaving = false;
    }
  }

  let emailInput = $state("");
  let emailPasswordInput = $state("");
  let emailError = $state("");
  let emailSaving = $state(false);
  let emailStep: "form" | "code" = $state("form");
  let emailCodeInput = $state("");
  let emailConfirmError = $state("");
  let emailConfirming = $state(false);

  function openEmailModal() {
    emailInput = "";
    emailPasswordInput = "";
    emailError = "";
    emailStep = "form";
    emailCodeInput = "";
    emailConfirmError = "";
    openModal = "email";
  }

  async function saveEmail() {
    emailError = "";
    emailSaving = true;
    try {
      await changeEmail({
        newEmail: emailInput.trim(),
        currentPassword: emailPasswordInput,
      });
      emailStep = "code";
    } catch (err) {
      emailError =
        err instanceof ApiError ? err.message : m.common_save_error_fallback();
    } finally {
      emailSaving = false;
    }
  }

  async function confirmEmail() {
    emailConfirmError = "";
    emailConfirming = true;
    try {
      await confirmEmailChange({ code: emailCodeInput.trim() });
      openModal = null;
      toast.success("Email mis à jour.");
    } catch (err) {
      emailConfirmError =
        err instanceof ApiError ? err.message : "Code invalide ou expiré";
    } finally {
      emailConfirming = false;
    }
  }

  let currentPasswordInput = $state("");
  let newPasswordInput = $state("");
  let confirmPasswordInput = $state("");
  let passwordError = $state("");
  let passwordSaving = $state(false);

  function openPasswordModal() {
    currentPasswordInput = "";
    newPasswordInput = "";
    confirmPasswordInput = "";
    passwordError = "";
    openModal = "password";
  }

  async function savePassword() {
    passwordError = "";
    if (newPasswordInput.length < 8) {
      passwordError = "8 caractères minimum.";
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      passwordError = "Les mots de passe ne correspondent pas.";
      return;
    }
    passwordSaving = true;
    try {
      await changePassword({
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput,
      });
      openModal = null;
      toast.success("Mot de passe mis à jour.");
    } catch (err) {
      passwordError =
        err instanceof ApiError ? err.message : m.common_save_error_fallback();
    } finally {
      passwordSaving = false;
    }
  }
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-4 text-lg font-bold">Sécurité</h2>
    <div class="divide-border divide-y">
      <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
        <div>
          <p class="text-dim text-sm">Nom d'utilisateur</p>
          <p class="font-semibold">{auth.user.username}</p>
        </div>
        <button class="link-accent text-sm" onclick={openUsernameModal}>
          Modifier
        </button>
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div>
          <p class="text-dim text-sm">Email</p>
          <p class="font-semibold">{auth.user.email}</p>
        </div>
        <button class="link-accent text-sm" onclick={openEmailModal}>
          Modifier
        </button>
      </div>
      <div class="flex items-center justify-between gap-4 py-3">
        <div>
          <p class="text-dim text-sm">Mot de passe</p>
          <p class="font-semibold tracking-widest">••••••••</p>
        </div>
        <button class="link-accent text-sm" onclick={openPasswordModal}>
          Modifier
        </button>
      </div>
      <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
        <div>
          <p class="text-dim text-sm">Appareils connectés</p>
          <p class="font-semibold">Sessions ouvertes sur ton compte</p>
        </div>
        <a href="/settings/sessions" class="link-accent text-sm"> Gérer </a>
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
            Nom d'utilisateur
          </span>
          <input
            type="text"
            class="input"
            maxlength="50"
            bind:value={usernameInput}
            oninput={onUsernameInput} />
        </label>
        {#if usernameCheck === "checking"}
          <p class="text-dim text-sm">Vérification…</p>
        {:else if usernameCheck === "available"}
          <p class="text-success text-sm">Disponible.</p>
        {:else if usernameCheck === "taken"}
          <p class="text-danger text-sm">Déjà pris.</p>
        {:else if usernameCheck === "error"}
          <p class="text-danger text-sm">Vérification impossible.</p>
        {/if}
        {#if usernameError}
          <p class="text-danger text-sm">{usernameError}</p>
        {/if}
        <div class="mt-2 flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" onclick={closeModal}>
            {m.common_cancel()}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={usernameSaving || usernameCheck !== "available"}>
            {usernameSaving ? m.common_save_loading() : m.common_save()}
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
              disabled={emailSaving ||
                !emailInput.trim() ||
                !emailPasswordInput}>
              {emailSaving ? m.common_save_loading() : m.common_save()}
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
            <span class="mb-1.5 block text-sm font-semibold">Code</span>
            <input
              type="text"
              inputmode="numeric"
              maxlength="6"
              class="input"
              placeholder="123456"
              bind:value={emailCodeInput} />
          </label>
          {#if emailConfirmError}
            <p class="text-danger text-sm">{emailConfirmError}</p>
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
              disabled={emailConfirming || emailCodeInput.trim().length !== 6}>
              {emailConfirming ? "Vérification…" : m.common_confirm()}
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
            Nouveau mot de passe
          </span>
          <PasswordInput
            autocomplete="new-password"
            minlength={8}
            bind:value={newPasswordInput} />
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
            disabled={passwordSaving ||
              !currentPasswordInput ||
              !newPasswordInput ||
              !confirmPasswordInput}>
            {passwordSaving ? m.common_save_loading() : m.common_save()}
          </button>
        </div>
      </form>
    </Modal>
  {/if}
{/if}
