<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    ApiError,
    login,
    loginWithPasskey,
    resendMfaEmailCode,
    verifyMfaLogin,
    verifyWebauthnMfaLogin,
  } from "#lib/api/client.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import FieldError from "#lib/components/FieldError.svelte";
  import Banner from "#lib/components/Banner.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import OtpInput from "#lib/components/OtpInput.svelte";
  import PasswordInput from "#lib/components/PasswordInput.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { Cooldown } from "#lib/cooldown.svelte.js";
  import { formatDateTime } from "#lib/format.js";
  import {
    isInstancePickerAvailable,
    openInstancePicker,
  } from "#lib/native/instance.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { formatRecoveryCode } from "#lib/one-time-code.js";
  import { m } from "#lib/paraglide/messages.js";
  import { ErrorCode, type MfaMethod, OTP_CODE_LENGTH } from "@loomkeep/shared";
  import { fly, slide } from "svelte/transition";

  const reduced = prefersReducedMotion();

  let identifier = $state("");
  let password = $state("");

  type Step = "credentials" | "choose-method" | "code";
  let step = $state<Step>("credentials");
  let challengeId = $state("");
  let availableMethods = $state<MfaMethod[]>([]);
  let selectedMethod = $state<MfaMethod>("totp");
  let codeInput = $state("");
  const resendCooldown = new Cooldown();

  // The API only reveals a suspension once the credentials are proven, and
  // sends its end date along — shown here instead of the generic error.
  let suspendedUntil = $state<string | null>(null);
  function noteSuspension(err: unknown) {
    suspendedUntil =
      err instanceof ApiError && err.code === ErrorCode.AuthAccountSuspended
        ? String(err.params?.until ?? "")
        : null;
  }

  // Only follow redirectTo when it stays on this site — anything else could
  // be an open-redirect vector (e.g. redirectTo=https://evil.example). The
  // browser's own URL parser decides rather than a prefix check: it reads
  // "/\evil.example" or a tab-split "/\t/evil.example" as another host.
  function safeRedirect(target: string | null): string {
    if (!target) return "/app";
    try {
      const url = new URL(target, page.url.origin);
      if (url.origin === page.url.origin) {
        return url.pathname + url.search + url.hash;
      }
    } catch {
      // Not a URL at all: fall through to the default.
    }
    return "/app";
  }

  const loginMut = createApiMutation(() => ({
    mutate: () => login({ identifier, password }),
    coveredFields: ["identifier"],
    onError: noteSuspension,
    onSuccess: (result) => {
      if (result.mfaRequired) {
        challengeId = result.challengeId;
        availableMethods = result.availableMethods;
        codeInput = "";
        const primaryMethods = result.availableMethods.filter(
          (method) => method !== "recovery",
        );
        if (primaryMethods.length === 1 && primaryMethods[0] !== "webauthn") {
          selectedMethod = primaryMethods[0];
          step = "code";
        } else {
          step = "choose-method";
          // A lone webauthn option has nothing to "choose" — fire the
          // browser prompt right away, the choose-method screen stays as
          // the place to show its loading/error/retry state.
          if (primaryMethods.length === 1 && primaryMethods[0] === "webauthn") {
            chooseMethod("webauthn");
          }
        }
        return;
      }
      void openAfterSignIn();
    },
  }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    loginMut.mutate();
  }

  // Only the email method needs a send before showing the code screen — TOTP
  // and recovery codes need nothing from the server. Sending here (rather
  // than eagerly for every MFA-enabled login) means an account with both
  // TOTP and email enabled only burns an email send if the user actually
  // picks that method.
  const sendEmailCodeMut = createApiMutation(() => ({
    mutate: () => resendMfaEmailCode(challengeId),
    onSuccess: () => {
      selectedMethod = "email";
      step = "code";
    },
  }));

  function chooseMethod(method: MfaMethod) {
    codeInput = "";
    lastVerified = "";
    verifyMut.reset();
    sendEmailCodeMut.reset();
    webauthnMfaMut.reset();

    if (method === "email") {
      sendEmailCodeMut.mutate();
      return;
    }

    if (method === "webauthn") {
      // No code screen for webauthn — the browser prompt is the whole
      // interaction, so stay on choose-method to show its state.
      step = "choose-method";
      webauthnMfaMut.mutate();
      return;
    }

    selectedMethod = method;
    step = "code";
  }

  // Replaces the sign-in page in the history: back from the app must not
  // land on it, only to be sent straight back into the app.
  function openAfterSignIn() {
    return goto(safeRedirect(page.url.searchParams.get("redirectTo")), {
      replace: true,
    });
  }

  const webauthnMfaMut = createApiMutation(() => ({
    mutate: () => verifyWebauthnMfaLogin(challengeId),
    onSuccess: () => openAfterSignIn(),
  }));

  const passwordlessMut = createApiMutation(() => ({
    mutate: () => loginWithPasskey(identifier.trim()),
    onError: noteSuspension,
    onSuccess: () => openAfterSignIn(),
  }));

  let rejected = $state(false);
  const verifyMut = createApiMutation(() => ({
    mutate: () => verifyMfaLogin({ challengeId, code: codeInput.trim() }),
    onSuccess: () => openAfterSignIn(),
    onError: () => (rejected = !reduced),
  }));

  // A complete six-digit code goes off on its own, typed or autofilled from
  // an email; retyping a digit of the same code doesn't send it again. A
  // recovery code still waits for the button.
  let lastVerified = "";
  function verifyComplete(code: string) {
    if (code === lastVerified) return;
    verify();
  }

  function verify() {
    lastVerified = codeInput;
    verifyMut.mutate();
  }

  function verifyCode(event: SubmitEvent) {
    event.preventDefault();
    verify();
  }

  function onRecoveryInput(event: Event & { currentTarget: HTMLInputElement }) {
    codeInput = formatRecoveryCode(event.currentTarget.value, codeInput);
    event.currentTarget.value = codeInput;
  }

  // An error stays a few seconds, long enough to read: the next attempt
  // starts from a clean form.
  const ERROR_VISIBLE_MS = 5000;
  function dismissAfterAWhile(mutation: {
    error: string | null;
    reset: () => void;
  }) {
    $effect(() => {
      if (!mutation.error) return;
      const timer = setTimeout(() => mutation.reset(), ERROR_VISIBLE_MS);
      return () => clearTimeout(timer);
    });
  }

  const resendEmailCodeMut = createApiMutation(() => ({
    mutate: () => resendMfaEmailCode(challengeId),
    onSuccess: () => resendCooldown.start(30),
  }));

  function resendEmailCode() {
    if (resendCooldown.remaining > 0) return;
    resendEmailCodeMut.mutate();
  }

  function backToCredentials() {
    step = "credentials";
    password = "";
    sendEmailCodeMut.reset();
    webauthnMfaMut.reset();
  }

  function backFromCode() {
    verifyMut.reset();
    resendEmailCodeMut.reset();
    if (availableMethods.filter((mth) => mth !== "recovery").length > 1) {
      step = "choose-method";
    } else {
      backToCredentials();
    }
  }

  dismissAfterAWhile(verifyMut);
  dismissAfterAWhile(resendEmailCodeMut);
  dismissAfterAWhile(sendEmailCodeMut);
  dismissAfterAWhile(webauthnMfaMut);
</script>

<svelte:head>
  <title>{m.auth_login_title()} · {m.common_loomkeep()}</title>
</svelte:head>

{#snippet method(
  icon: "qr-code" | "mail" | "key",
  label: string,
  description: string,
  busy: boolean,
  disabled: boolean,
  onclick: () => void,
)}
  <button
    type="button"
    class="border-border hover:border-accent hover:bg-accent/5 focus-visible:border-accent flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
    {disabled}
    {onclick}>
    <span
      class="bg-accent/12 text-accent grid size-10 shrink-0 place-items-center rounded-full"
      class:animate-pulse={busy}>
      <Icon name={icon} class="h-5 w-5" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block font-semibold">{label}</span>
      <span class="text-dim block text-sm">{description}</span>
    </span>
    <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
  </button>
{/snippet}

<!-- Each step, and each kind of code, slides in like a new auth page. -->
{#key step === "code" ? `code:${selectedMethod}` : step}
  <div
    class="flex flex-1 flex-col lg:flex-none"
    in:fly={{ y: reduced ? 0 : 10, duration: reduced ? 0 : 220 }}>
    {#if step === "credentials"}
      <form onsubmit={submit} class="flex flex-1 flex-col gap-4 lg:flex-none">
        <h1 class="font-display text-2xl font-bold">
          {m.auth_login_title()}
        </h1>
        <input
          type="text"
          name="identifier"
          autocomplete="name"
          autocapitalize="words"
          enterkeyhint="next"
          aria-label={m.auth_login_identifier_placeholder()}
          aria-invalid={loginMut.fieldErrors.identifier ? "true" : undefined}
          aria-describedby={loginMut.fieldErrors.identifier
            ? "login-identifier-error"
            : undefined}
          placeholder={m.auth_login_identifier_placeholder()}
          bind:value={identifier}
          required
          class="input" />
        <FieldError
          id="login-identifier-error"
          message={loginMut.fieldErrors.identifier} />
        <PasswordInput
          placeholder={m.common_password()}
          name="password"
          ariaLabel={m.common_password()}
          autocomplete="current-password"
          enterkeyhint="go"
          bind:value={password}
          required />
        <p class="text-dim -mt-2 text-right text-sm">
          <a href="/forgot-password" class="link-accent text-sm"
            >{m.auth_forgot_password()}</a>
        </p>
        <!-- On a phone the submit sits at the bottom, over the keyboard once
           it opens. -->
        <div class="flex-1 lg:hidden"></div>
        {#if suspendedUntil !== null && (loginMut.error || passwordlessMut.error)}
          <div
            role="alert"
            class="border-danger rounded-lg border border-l-4 p-3"
            in:fly={{ y: reduced ? 0 : -6, duration: reduced ? 0 : 200 }}>
            <p class="font-semibold">{m.auth_suspended_title()}</p>
            <p class="text-dim mt-1 text-sm">
              {m.auth_suspended_body({
                date: suspendedUntil ? formatDateTime(suspendedUntil) : "",
              })}
            </p>
            {#if appConfig.supportEmail}
              <p class="text-dim mt-2 text-sm">
                {m.auth_suspended_contact()}
                <a
                  href="mailto:{appConfig.supportEmail}"
                  class="link-accent text-sm">{appConfig.supportEmail}</a>
              </p>
            {/if}
          </div>
        {:else if loginMut.error}
          <Banner variant="error">{loginMut.error}</Banner>
        {/if}
        <button
          type="submit"
          class="btn btn-primary"
          disabled={loginMut.loading}>
          {loginMut.loading ? m.auth_login_action_loading() : m.common_login()}
        </button>
        <!-- A security key is offered once it knows whose account to open. -->
        <button
          type="button"
          class="btn border-accent text-accent hover:bg-accent/10 border"
          disabled={!identifier.trim() || passwordlessMut.loading}
          onclick={() => passwordlessMut.mutate()}>
          <Icon name="key" class="h-4 w-4" />
          {passwordlessMut.loading
            ? m.auth_mfa_webauthn_waiting()
            : m.auth_passwordless_login()}
        </button>
        {#if passwordlessMut.error && suspendedUntil === null}
          <Banner variant="error">{passwordlessMut.error}</Banner>
        {/if}
        {#if appConfig.registrationEnabled}
          <p class="text-dim text-center text-sm">
            {m.auth_no_account()}
            <a href="/register" class="link-accent text-sm"
              >{m.common_register()}</a>
          </p>
        {:else}
          <p class="text-dim text-center text-sm">
            {m.auth_registration_invite_only()}
          </p>
        {/if}
        {#if isInstancePickerAvailable()}
          <button
            type="button"
            class="btn-text self-center text-sm"
            onclick={() => void openInstancePicker()}>
            {m.auth_other_instance()}
          </button>
        {/if}
      </form>
    {:else if step === "choose-method"}
      <div class="flex flex-1 flex-col gap-4 lg:flex-none">
        <h1 class="font-display text-2xl font-bold">
          {m.auth_mfa_choose_method_title()}
        </h1>
        <div class="flex flex-col gap-3">
          {#if availableMethods.includes("totp")}
            {@render method(
              "qr-code",
              m.auth_mfa_totp_label(),
              m.auth_mfa_choose_method_totp_desc(),
              false,
              sendEmailCodeMut.loading,
              () => chooseMethod("totp"),
            )}
          {/if}
          {#if availableMethods.includes("email")}
            {@render method(
              "mail",
              m.auth_mfa_email_label(),
              sendEmailCodeMut.loading
                ? m.auth_mfa_sending_code()
                : m.auth_mfa_choose_method_email_desc(),
              sendEmailCodeMut.loading,
              sendEmailCodeMut.loading,
              () => chooseMethod("email"),
            )}
          {/if}
          {#if availableMethods.includes("webauthn")}
            {@render method(
              "key",
              m.common_security_key(),
              webauthnMfaMut.loading
                ? m.auth_mfa_webauthn_waiting()
                : m.auth_mfa_choose_method_webauthn_desc(),
              webauthnMfaMut.loading,
              webauthnMfaMut.loading,
              () => chooseMethod("webauthn"),
            )}
          {/if}
        </div>
        {#if sendEmailCodeMut.error || webauthnMfaMut.error}
          <div out:slide={{ duration: reduced ? 0 : 150 }}>
            <Banner variant="error"
              >{sendEmailCodeMut.error ?? webauthnMfaMut.error}</Banner>
          </div>
        {/if}
        <div class="flex-1 lg:hidden"></div>
        <button
          type="button"
          class="btn-text self-center text-sm"
          onclick={backToCredentials}>
          {m.common_back()}
        </button>
      </div>
    {:else}
      <form
        onsubmit={verifyCode}
        class="flex flex-1 flex-col gap-4 lg:flex-none">
        <div>
          <h1 class="font-display text-2xl font-bold">
            {m.auth_mfa_code_title()}
          </h1>
          {#if selectedMethod !== "webauthn"}
            <p class="text-dim mt-2 text-sm">
              {selectedMethod === "email"
                ? m.auth_mfa_code_email_hint()
                : selectedMethod === "recovery"
                  ? m.auth_mfa_code_recovery_hint()
                  : m.auth_mfa_code_totp_hint()}
            </p>
          {/if}
        </div>
        <!-- A rejected code shakes its field, as a head saying no. -->
        <div
          class:code-rejected={rejected}
          onanimationend={() => (rejected = false)}>
          {#if selectedMethod === "recovery"}
            <label class="block">
              <span class="mb-1.5 block text-sm font-semibold">
                {m.auth_mfa_recovery_code_label()}
              </span>
              <input
                type="text"
                name="code"
                autocapitalize="characters"
                autocomplete="off"
                spellcheck="false"
                required
                enterkeyhint="done"
                class="input text-center font-mono text-xl! tracking-[0.2em]"
                placeholder="XXXXX-XXXXX"
                value={codeInput}
                oninput={onRecoveryInput} />
            </label>
          {:else}
            <OtpInput
              length={OTP_CODE_LENGTH}
              label={m.common_code()}
              oninput={(code) => (codeInput = code)}
              oncomplete={verifyComplete} />
          {/if}
        </div>

        {#if selectedMethod === "email"}
          <button
            type="button"
            class="link-accent -mt-2 text-left text-sm"
            onclick={resendEmailCode}
            disabled={resendCooldown.remaining > 0}>
            {resendCooldown.remaining > 0
              ? m.common_resend_cooldown({ seconds: resendCooldown.remaining })
              : m.auth_mfa_resend_email_code()}
          </button>
        {/if}

        <div class="flex-1 lg:hidden"></div>
        {#if verifyMut.error || resendEmailCodeMut.error}
          <div out:slide={{ duration: reduced ? 0 : 150 }}>
            <Banner variant="error"
              >{verifyMut.error ?? resendEmailCodeMut.error}</Banner>
          </div>
        {/if}

        <button
          type="submit"
          class="btn btn-primary"
          disabled={verifyMut.loading ||
            (selectedMethod === "recovery"
              ? !codeInput
              : codeInput.length < OTP_CODE_LENGTH)}>
          {verifyMut.loading ? m.common_verifying() : m.common_verify()}
        </button>

        <div class="flex items-center justify-between text-sm">
          <button type="button" class="btn-text" onclick={backFromCode}>
            {m.common_back()}
          </button>
          {#if selectedMethod === "recovery"}
            <button
              type="button"
              class="link-accent"
              onclick={() =>
                chooseMethod(
                  availableMethods.find((mth) => mth !== "recovery") ?? "totp",
                )}>
              {m.auth_mfa_use_normal_code()}
            </button>
          {:else}
            <button
              type="button"
              class="link-accent text-sm"
              onclick={() => chooseMethod("recovery")}>
              {m.auth_mfa_use_recovery_code()}
            </button>
          {/if}
        </div>
      </form>
    {/if}
  </div>
{/key}

<style>
  .code-rejected {
    animation: code-rejected 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }

  @keyframes code-rejected {
    20%,
    60% {
      transform: translateX(-8px);
    }
    40%,
    80% {
      transform: translateX(8px);
    }
  }
</style>
