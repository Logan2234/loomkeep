<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { resetPassword } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import PasswordRequirements from "$lib/components/PasswordRequirements.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { isPasswordValid } from "@loomkeep/shared";

  const token = page.url.searchParams.get("token") ?? "";

  let newPassword = $state("");
  let confirmPassword = $state("");
  let localError = $state<string | null>(null);

  const resetMut = createApiMutation(() => ({
    mutate: () => resetPassword(token, newPassword),
    onSuccess: () => goto("/login"),
  }));

  const error = $derived(localError ?? resetMut.error);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    localError = null;

    if (!isPasswordValid(newPassword)) {
      localError = m.auth_reset_password_requirements_unmet();
      return;
    }

    if (newPassword !== confirmPassword) {
      localError = m.auth_reset_password_mismatch();
      return;
    }

    resetMut.mutate();
  }
</script>

<div class="flex min-h-screen flex-col">
  <div class="flex flex-1 items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <p class="font-display text-3xl font-extrabold tracking-tight">
          {m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span>
        </p>
      </div>

      <div class="card flex flex-col gap-4 p-7">
        <h1 class="font-display text-xl font-bold">
          {m.common_new_password()}
        </h1>

        {#if !token}
          <p class="text-danger text-sm">
            {m.link_invalid_missing_token()}
          </p>
        {:else}
          <form onsubmit={submit} class="flex flex-col gap-4">
            <PasswordInput
              placeholder={m.common_new_password()}
              bind:value={newPassword}
              minlength={8}
              required />
            <PasswordRequirements value={newPassword} />
            <PasswordInput
              placeholder={m.auth_reset_password_confirm_placeholder()}
              bind:value={confirmPassword}
              minlength={8}
              required />
            {#if error}<p class="text-danger text-sm">{error}</p>{/if}
            <button
              type="submit"
              class="btn btn-primary"
              disabled={resetMut.loading}>
              {resetMut.loading ? m.common_save_loading() : m.common_reset()}
            </button>
          </form>
        {/if}

        <p class="text-center">
          <a
            href="/login"
            class="btn-text btn-text-underline hover:text-accent text-sm"
            >{m.auth_back_to_login()}</a>
        </p>
      </div>
    </div>
  </div>
  <LegalLinks />
</div>
