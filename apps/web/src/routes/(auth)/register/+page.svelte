<script lang="ts">
  import { goto } from "$app/navigation";
  import { env } from "$env/dynamic/public";
  import { register } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
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

  const registerMut = createApiMutation(() => ({
    mutate: register,
    coveredFields: ["displayName", "email", "acceptedTerms", "certifiedAge"],
    onSuccess: () => goto("/register/check-email"),
  }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    registerMut.mutate({
      email,
      password,
      displayName,
      acceptedTerms,
      certifiedAge,
      turnstileToken,
    });
  }
</script>

<div class="flex min-h-screen flex-col">
  <div class="flex flex-1 items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <p class="font-display text-3xl font-extrabold tracking-tight">
          {m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span>
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
          name="displayName"
          minlength="1"
          maxlength="50"
          aria-label={m.common_username()}
          aria-invalid={registerMut.fieldErrors.displayName
            ? "true"
            : undefined}
          aria-describedby={registerMut.fieldErrors.displayName
            ? "register-display-name-error"
            : undefined}
          placeholder={m.common_username()}
          bind:value={displayName}
          required
          class="input" />
        {#if registerMut.fieldErrors.displayName}
          <p id="register-display-name-error" class="text-danger -mt-2 text-xs">
            {registerMut.fieldErrors.displayName}
          </p>
        {/if}
        <input
          type="email"
          name="email"
          autocomplete="email"
          aria-label={m.common_email()}
          aria-invalid={registerMut.fieldErrors.email ? "true" : undefined}
          aria-describedby={registerMut.fieldErrors.email
            ? "register-email-error"
            : undefined}
          placeholder={m.common_email()}
          bind:value={email}
          required
          class="input" />
        {#if registerMut.fieldErrors.email}
          <p id="register-email-error" class="text-danger -mt-2 text-xs">
            {registerMut.fieldErrors.email}
          </p>
        {/if}
        <PasswordInput
          placeholder={m.common_password()}
          name="password"
          ariaLabel={m.common_password()}
          autocomplete="new-password"
          enterkeyhint="done"
          bind:value={password}
          minlength={8}
          maxlength={72}
          required />
        <PasswordRequirements value={password} />
        {#if turnstileSiteKey}
          <Turnstile
            siteKey={turnstileSiteKey}
            onVerify={(token) => (turnstileToken = token)} />
        {/if}
        {#if registerMut.error}
          <Banner variant="error">{registerMut.error}</Banner>
        {/if}
        <label class="text-dim flex items-start gap-2 text-xs leading-relaxed">
          <input
            type="checkbox"
            name="acceptedTerms"
            value="true"
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
        {#if registerMut.fieldErrors.acceptedTerms}
          <p class="text-danger -mt-2 text-xs">
            {registerMut.fieldErrors.acceptedTerms}
          </p>
        {/if}
        <label class="text-dim flex items-start gap-2 text-xs leading-relaxed">
          <input
            type="checkbox"
            name="certifiedAge"
            value="true"
            bind:checked={certifiedAge}
            required
            class="mt-0.5" />
          <span>{m.auth_register_certify_age()}</span>
        </label>
        {#if registerMut.fieldErrors.certifiedAge}
          <p class="text-danger -mt-2 text-xs">
            {registerMut.fieldErrors.certifiedAge}
          </p>
        {/if}
        <button
          type="submit"
          class="btn btn-primary"
          disabled={registerMut.loading ||
            !displayName ||
            !email ||
            !isPasswordValid(password) ||
            !acceptedTerms ||
            !certifiedAge ||
            (!!turnstileSiteKey && !turnstileToken)}>
          {registerMut.loading
            ? m.auth_register_action_loading()
            : m.auth_register_action()}
        </button>
        <p class="text-dim text-center text-sm">
          {m.auth_already_registered()}
          <a
            href="/login"
            class="btn-text btn-text-underline text-accent hover:text-accent text-sm"
            >{m.common_login()}</a>
        </p>
      </form>
    </div>
  </div>
  <LegalLinks />
</div>
