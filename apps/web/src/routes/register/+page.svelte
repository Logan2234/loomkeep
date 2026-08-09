<script lang="ts">
  import { goto } from "$app/navigation";
  import { env } from "$env/dynamic/public";
  import { isPasswordValid } from "@loomkeep/shared";
  import { ApiError, register } from "$lib/api/client";
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import PasswordRequirements from "$lib/components/PasswordRequirements.svelte";
  import Turnstile from "$lib/components/Turnstile.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";

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
      await goto("/register/check-email");
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

<div class="flex min-h-screen flex-col">
  <div class="flex flex-1 items-center justify-center px-4 py-12">
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
        <h1 class="font-display text-xl font-bold">
          {m.auth_register_title()}
        </h1>
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
        <PasswordRequirements value={password} />
        {#if turnstileSiteKey}
          <Turnstile
            siteKey={turnstileSiteKey}
            onVerify={(token) => (turnstileToken = token)} />
        {/if}
        {#if error}<p class="text-danger text-sm">{error}</p>{/if}
        <p class="text-dim text-center text-xs leading-relaxed">
          En créant un compte, vous acceptez les
          <a
            href="/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            class="link-accent">CGU</a>
          et reconnaissez avoir lu notre
          <a
            href="/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            class="link-accent">politique de confidentialité</a
          >.
        </p>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={loading ||
            !isPasswordValid(password) ||
            (!!turnstileSiteKey && !turnstileToken)}>
          {loading
            ? m.auth_register_action_loading()
            : m.auth_register_action()}
        </button>
        <p class="text-dim text-center text-sm">
          {m.auth_already_registered()}
          <a href="/login" class="link-accent">{m.auth_login_action()}</a>
        </p>
      </form>
    </div>
  </div>
  <LegalLinks />
</div>
