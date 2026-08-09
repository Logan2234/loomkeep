<script lang="ts">
  import { goto } from "$app/navigation";
  import { ApiError, login } from "$lib/api/client";
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";

  let identifier = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    loading = true;
    try {
      await login({ identifier, password });
      await goto("/");
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : m.auth_login_error_fallback();
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
        <p class="text-dim mt-2 text-sm">{m.auth_login_tagline()}</p>
      </div>

      <form onsubmit={submit} class="card flex flex-col gap-4 p-7">
        <h1 class="font-display text-xl font-bold">{m.auth_login_title()}</h1>
        <input
          type="text"
          placeholder={m.auth_login_identifier_placeholder()}
          bind:value={identifier}
          required
          class="input" />
        <PasswordInput
          placeholder={m.auth_login_password_placeholder()}
          bind:value={password}
          required />
        <a
          href="/forgot-password"
          class="text-dim hover:text-accent -mt-2 text-right text-sm hover:underline"
          >{m.auth_forgot_password()}</a>
        {#if error}<p class="text-danger text-sm">{error}</p>{/if}
        <button type="submit" class="btn btn-primary" disabled={loading}>
          {loading ? m.auth_login_action_loading() : m.auth_login_action()}
        </button>
        {#if appConfig.registrationEnabled}
          <p class="text-dim text-center text-sm">
            {m.auth_no_account()}
            <a href="/register" class="link-accent"
              >{m.auth_create_account_link()}</a>
          </p>
        {/if}
      </form>
    </div>
  </div>
  <LegalLinks />
</div>
