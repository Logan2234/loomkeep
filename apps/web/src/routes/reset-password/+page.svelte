<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { ApiError, resetPassword } from "$lib/api/client";
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { m } from "$lib/paraglide/messages.js";

  const token = $page.url.searchParams.get("token") ?? "";

  let newPassword = $state("");
  let confirmPassword = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;

    if (newPassword !== confirmPassword) {
      error = m.auth_reset_password_mismatch();
      return;
    }

    loading = true;
    try {
      await resetPassword(token, newPassword);
      await goto("/login");
    } catch (err) {
      error =
        err instanceof ApiError
          ? err.message
          : m.auth_reset_password_error_fallback();
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen flex-col">
  <div class="flex flex-1 items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <p class="font-display text-3xl font-extrabold tracking-tight">
        LOOM<span class="text-accent">KEEP</span>
      </p>
    </div>

    <div class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">
        {m.auth_reset_password_title()}
      </h1>

      {#if !token}
        <p class="text-danger text-sm">
          {m.auth_reset_password_invalid_link()}
        </p>
      {:else}
        <form onsubmit={submit} class="flex flex-col gap-4">
          <PasswordInput
            placeholder={m.auth_reset_password_new_placeholder()}
            bind:value={newPassword}
            minlength={8}
            required />
          <PasswordInput
            placeholder={m.auth_reset_password_confirm_placeholder()}
            bind:value={confirmPassword}
            minlength={8}
            required />
          {#if error}<p class="text-danger text-sm">{error}</p>{/if}
          <button type="submit" class="btn btn-primary" disabled={loading}>
            {loading ? m.common_save_loading() : m.auth_reset_password_action()}
          </button>
        </form>
      {/if}

      <p class="text-dim text-center text-sm">
        <a href="/login" class="link-accent">{m.auth_back_to_login()}</a>
      </p>
    </div>
    </div>
  </div>
  <LegalLinks />
</div>
