<script lang="ts">
  import { env } from "$env/dynamic/public";
  import { goto } from "$app/navigation";
  import { register, ApiError } from "$lib/api/client";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import Turnstile from "$lib/components/Turnstile.svelte";

  // Empty = self-host without a Cloudflare account configured — no widget,
  // register() sends no token and the API's own check no-ops the same way.
  const turnstileSiteKey = env.PUBLIC_TURNSTILE_SITE_KEY;

  // Direct-URL access when registration is closed: bounce to login rather
  // than showing a dead-end form (the API rejects the submit anyway).
  $effect(() => {
    if (!appConfig.registrationEnabled) void goto("/login");
  });

  let displayName = $state("");
  let email = $state("");
  let password = $state("");
  let turnstileToken = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    loading = true;
    try {
      await register({ email, password, displayName, turnstileToken });
      await goto("/");
    } catch (err) {
      error =
        err instanceof ApiError
          ? err.message
          : m.auth_register_error_fallback();
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <p class="font-display text-3xl font-extrabold tracking-tight">
        LOOM<span class="text-accent">KEEP</span>
      </p>
      <p class="text-dim mt-2 text-sm">
        {m.auth_register_tagline()}
      </p>
    </div>

    <form onsubmit={submit} class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">{m.auth_register_title()}</h1>
      <input
        type="text"
        placeholder={m.auth_register_display_name_placeholder()}
        bind:value={displayName}
        required
        class="input" />
      <input
        type="email"
        placeholder={m.auth_register_email_placeholder()}
        bind:value={email}
        required
        class="input" />
      <PasswordInput
        placeholder={m.auth_register_password_placeholder()}
        bind:value={password}
        minlength={8}
        required />
      {#if turnstileSiteKey}
        <Turnstile
          siteKey={turnstileSiteKey}
          onVerify={(token) => (turnstileToken = token)} />
      {/if}
      {#if error}<p class="text-danger text-sm">{error}</p>{/if}
      <button
        type="submit"
        class="btn btn-primary"
        disabled={loading || (!!turnstileSiteKey && !turnstileToken)}>
        {loading ? m.auth_register_action_loading() : m.auth_register_action()}
      </button>
      <p class="text-dim text-center text-sm">
        {m.auth_already_registered()}
        <a href="/login" class="link-accent">{m.auth_login_action()}</a>
      </p>
    </form>
  </div>
</div>
