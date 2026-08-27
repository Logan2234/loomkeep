<script lang="ts">
  import { goto } from "$app/navigation";
  import { env } from "$env/dynamic/public";
  import { register } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
  import Banner from "$lib/components/Banner.svelte";
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import PasswordRequirements from "$lib/components/PasswordRequirements.svelte";
  import Turnstile from "$lib/components/Turnstile.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { isPasswordValid } from "@loomkeep/shared";

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
  let acceptedTerms = $state(false);
  let certifiedAge = $state(false);
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    loading = true;
    try {
      await register({
        email,
        password,
        displayName,
        acceptedTerms,
        certifiedAge,
        turnstileToken,
      });
      await goto("/register/check-email");
    } catch (err) {
      error = resolveApiError(err);
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
          {m.common_register()}
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
        {#if error}<Banner variant="error">{error}</Banner>{/if}
        <label class="text-dim flex items-start gap-2 text-xs leading-relaxed">
          <input
            type="checkbox"
            bind:checked={acceptedTerms}
            required
            class="mt-0.5" />
          <span>
            {m.auth_register_accept_terms_prefix()}
            <a
              href="/legal/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-text btn-text-underline text-accent hover:text-accent"
              >{m.common_terms()}</a>
            {m.auth_register_accept_terms_and()}
            <a
              href="/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-text btn-text-underline text-accent hover:text-accent"
              >{m.common_privacy()}</a
            >.
          </span>
        </label>
        <label class="text-dim flex items-start gap-2 text-xs leading-relaxed">
          <input
            type="checkbox"
            bind:checked={certifiedAge}
            required
            class="mt-0.5" />
          <span>{m.auth_register_certify_age()}</span>
        </label>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={loading ||
            !displayName ||
            !email ||
            !isPasswordValid(password) ||
            !acceptedTerms ||
            !certifiedAge ||
            (!!turnstileSiteKey && !turnstileToken)}>
          {loading
            ? m.auth_register_action_loading()
            : m.auth_register_action()}
        </button>
        <p class="text-dim text-center text-sm">
          {m.auth_already_registered()}
          <a
            href="/login"
            class="btn-text btn-text-underline text-accent hover:text-accent text-sm"
            >{m.auth_login_action()}</a>
        </p>
      </form>
    </div>
  </div>
  <LegalLinks />
</div>
