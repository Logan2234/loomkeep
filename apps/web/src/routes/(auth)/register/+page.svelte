<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { previewInvitation, register } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import FieldError from "#lib/components/FieldError.svelte";
  import AuthShell from "#lib/components/AuthShell.svelte";
  import Banner from "#lib/components/Banner.svelte";
  import PasswordInput from "#lib/components/PasswordInput.svelte";
  import PasswordRequirements from "#lib/components/PasswordRequirements.svelte";
  import Turnstile from "#lib/components/Turnstile.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    isPasswordValid,
    PASSWORD_MIN_LENGTH,
    PASSWORD_MAX_LENGTH,
    USER_LIMITS,
  } from "@loomkeep/shared";
  import { untrack } from "svelte";
  import { fade, slide } from "svelte/transition";

  // Empty = self-host without a Cloudflare account configured — no widget,
  // register() sends no token and the API's own check no-ops the same way.
  const turnstileSiteKey = env.PUBLIC_TURNSTILE_SITE_KEY;

  const reduced = prefersReducedMotion();

  // An invitation link (/register?invite=…) is what opens the form on a
  // closed instance — read once: the token is the page's subject.
  const inviteToken = untrack(() => page.url.searchParams.get("invite") ?? "");
  const inviteQuery = createApiQuery(() => ({
    key: keys.verification.invitation(inviteToken),
    fetch: () => previewInvitation(inviteToken),
    enabled: inviteToken !== "",
    retry: 0,
  }));
  const invite = $derived(inviteQuery.data);
  // A dead link on an open instance still leaves the ordinary sign-up.
  const blocked = $derived(
    !appConfig.registrationEnabled && (!inviteToken || !!inviteQuery.error),
  );

  // Direct-URL access when registration is closed and there's no invitation
  // to redeem: bounce to login rather than showing a dead-end form (the API
  // rejects the submit anyway).
  $effect(() => {
    if (!appConfig.registrationEnabled && !inviteToken) void goto("/login");
  });

  // An address-bound invitation fixes the email: prefill it.
  $effect(() => {
    if (invite?.email) email = invite.email;
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
    // An address-bound invitation verified the email already: nothing to
    // check in the inbox.
    onSuccess: () => goto(invite?.email ? "/app" : "/register/check-email"),
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
      inviteToken: invite ? inviteToken : undefined,
    });
  }
</script>

<svelte:head>
  <title>{m.common_register()} · {m.common_loomkeep()}</title>
</svelte:head>

<AuthShell>
  {#snippet tagline()}{m.auth_register_tagline()}{/snippet}

  {#if inviteToken && inviteQuery.loading}
    <div
      class="card text-dim flex items-center justify-center gap-2 p-7 text-sm"
      role="status">
      <Icon name="mail" class="h-4 w-4 {reduced ? '' : 'animate-pulse'}" />
      {m.auth_invitation_checking()}
    </div>
  {:else if blocked}
    <div
      class="card flex flex-col items-center gap-4 p-7 text-center"
      in:fade={{ duration: reduced ? 0 : 180 }}>
      <span
        class="bg-danger/10 text-danger grid h-12 w-12 place-items-center rounded-full">
        <Icon name="mail" class="h-5 w-5" />
      </span>
      <p class="text-sm">{inviteQuery.error}</p>
      <a href="/login" class="btn btn-ghost">
        {m.auth_invitation_back_to_login()}
      </a>
    </div>
  {:else}
    <form onsubmit={submit} class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">
        {m.common_register()}
      </h1>
      {#if invite}
        <div
          class="border-accent/40 bg-accent/10 flex items-start gap-3 rounded-lg border px-3.5 py-3"
          in:slide={{ duration: reduced ? 0 : 200 }}>
          <span
            class="bg-accent text-accent-fg grid h-8 w-8 shrink-0 place-items-center rounded-full">
            <Icon name="send" class="h-4 w-4" />
          </span>
          <div class="min-w-0 text-sm">
            <p class="text-fg font-semibold">
              {invite.inviterName
                ? m.auth_invitation_from({ name: invite.inviterName })
                : m.auth_invitation_generic()}
            </p>
            <p class="text-dim">{m.auth_invitation_body()}</p>
          </div>
        </div>
      {:else if inviteQuery.error}
        <Banner variant="warning">{inviteQuery.error}</Banner>
      {/if}
      <input
        type="text"
        name="displayName"
        minlength="1"
        maxlength={USER_LIMITS.displayName}
        aria-label={m.common_username()}
        aria-invalid={registerMut.fieldErrors.displayName ? "true" : undefined}
        aria-describedby={registerMut.fieldErrors.displayName
          ? "register-display-name-error"
          : undefined}
        placeholder={m.common_username()}
        bind:value={displayName}
        required
        class="input" />
      <FieldError
        id="register-display-name-error"
        message={registerMut.fieldErrors.displayName} />
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
        readonly={!!invite?.email}
        required
        class="input {invite?.email ? 'text-dim' : ''}" />
      {#if invite?.email}
        <p class="text-dim -mt-2 flex items-center gap-1.5 text-xs">
          <Icon name="lock" class="h-3 w-3" />
          {m.auth_invitation_email_locked()}
        </p>
      {/if}
      <FieldError
        id="register-email-error"
        message={registerMut.fieldErrors.email} />
      <PasswordInput
        placeholder={m.common_password()}
        name="password"
        ariaLabel={m.common_password()}
        autocomplete="new-password"
        enterkeyhint="done"
        bind:value={password}
        minlength={PASSWORD_MIN_LENGTH}
        maxlength={PASSWORD_MAX_LENGTH}
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
            class="link-accent">{m.common_terms()}</a>
          {m.auth_register_accept_terms_and()}
          <a
            href="/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            class="link-accent">{m.common_privacy()}</a
          >.
        </span>
      </label>
      <FieldError message={registerMut.fieldErrors.acceptedTerms} />
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
      <FieldError message={registerMut.fieldErrors.certifiedAge} />
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
        <a href="/login" class="link-accent text-sm">{m.common_login()}</a>
      </p>
    </form>
  {/if}
</AuthShell>
