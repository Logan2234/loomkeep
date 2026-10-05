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
  } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import FieldError from "$lib/components/FieldError.svelte";
  import AuthShell from "$lib/components/AuthShell.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { Cooldown } from "$lib/cooldown.svelte";
  import { formatDateTime } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { normalizeCodeInput } from "$lib/one-time-code";
  import { m } from "$lib/paraglide/messages.js";
  import {
    ErrorCode,
    type MfaMethod,
    OTP_CODE_LENGTH,
    RECOVERY_CODE_LENGTH,
  } from "@loomkeep/shared";
  import { fly } from "svelte/transition";

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
      void goto(safeRedirect(page.url.searchParams.get("redirectTo")));
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
    verifyMut.reset();

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

  const webauthnMfaMut = createApiMutation(() => ({
    mutate: () => verifyWebauthnMfaLogin(challengeId),
    onSuccess: () =>
      goto(safeRedirect(page.url.searchParams.get("redirectTo"))),
  }));

  const passwordlessMut = createApiMutation(() => ({
    mutate: () => loginWithPasskey(identifier.trim()),
    onError: noteSuspension,
    onSuccess: () =>
      goto(safeRedirect(page.url.searchParams.get("redirectTo"))),
  }));

  const verifyMut = createApiMutation(() => ({
    mutate: () => verifyMfaLogin({ challengeId, code: codeInput.trim() }),
    onSuccess: () =>
      goto(safeRedirect(page.url.searchParams.get("redirectTo"))),
  }));

  function verifyCode(event: SubmitEvent) {
    event.preventDefault();
    verifyMut.mutate();
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
  }
</script>

<svelte:head>
  <title>{m.auth_login_title()} · {m.common_loomkeep()}</title>
</svelte:head>

<AuthShell>
  {#snippet tagline()}{m.auth_login_tagline()}{/snippet}

  {#if step === "credentials"}
    <form onsubmit={submit} class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">{m.auth_login_title()}</h1>
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
      <button type="submit" class="btn btn-primary" disabled={loginMut.loading}>
        {loginMut.loading ? m.auth_login_action_loading() : m.common_login()}
      </button>
      <button
        type="button"
        class="btn-text self-center text-sm"
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
    </form>
  {:else if step === "choose-method"}
    <div class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">
        {m.auth_mfa_choose_method_title()}
      </h1>
      <div class="flex flex-col gap-3">
        {#if availableMethods.includes("totp")}
          <button
            type="button"
            class="border-border hover:border-accent hover:bg-accent/5 flex items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
            disabled={sendEmailCodeMut.loading}
            onclick={() => chooseMethod("totp")}>
            <Icon name="qr-code" class="text-accent h-6 w-6 shrink-0" />
            <span>
              <span class="block font-semibold">
                {m.auth_mfa_totp_label()}
              </span>
              <span class="text-dim block text-sm">
                {m.auth_mfa_choose_method_totp_desc()}
              </span>
            </span>
          </button>
        {/if}
        {#if availableMethods.includes("email")}
          <button
            type="button"
            class="border-border hover:border-accent hover:bg-accent/5 flex items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
            disabled={sendEmailCodeMut.loading}
            onclick={() => chooseMethod("email")}>
            <Icon name="mail" class="text-accent h-6 w-6 shrink-0" />
            <span>
              <span class="block font-semibold">
                {m.auth_mfa_email_label()}
              </span>
              <span class="text-dim block text-sm">
                {sendEmailCodeMut.loading
                  ? m.auth_mfa_sending_code()
                  : m.auth_mfa_choose_method_email_desc()}
              </span>
            </span>
          </button>
        {/if}
        {#if availableMethods.includes("webauthn")}
          <button
            type="button"
            class="border-border hover:border-accent hover:bg-accent/5 flex items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
            disabled={webauthnMfaMut.loading}
            onclick={() => chooseMethod("webauthn")}>
            <Icon name="key" class="text-accent h-6 w-6 shrink-0" />
            <span>
              <span class="block font-semibold">
                {m.common_security_key()}
              </span>
              <span class="text-dim block text-sm">
                {webauthnMfaMut.loading
                  ? m.auth_mfa_webauthn_waiting()
                  : m.auth_mfa_choose_method_webauthn_desc()}
              </span>
            </span>
          </button>
        {/if}
      </div>
      {#if sendEmailCodeMut.error}
        <Banner variant="error">{sendEmailCodeMut.error}</Banner>
      {/if}
      {#if webauthnMfaMut.error}
        <Banner variant="error">{webauthnMfaMut.error}</Banner>
      {/if}
      <button
        type="button"
        class="btn-text self-center text-sm"
        onclick={backToCredentials}>
        {m.common_back()}
      </button>
    </div>
  {:else}
    <form onsubmit={verifyCode} class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">
        {m.auth_mfa_code_title()}
      </h1>
      <p class="text-dim text-sm">
        {selectedMethod === "email"
          ? m.auth_mfa_code_email_hint()
          : selectedMethod === "totp"
            ? m.auth_mfa_code_totp_hint()
            : ""}
      </p>
      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">
          {selectedMethod === "recovery"
            ? m.auth_mfa_recovery_code_label()
            : m.common_code()}
        </span>
        <input
          type="text"
          name="code"
          inputmode={selectedMethod === "recovery" ? "text" : "numeric"}
          autocomplete={selectedMethod === "recovery"
            ? undefined
            : "one-time-code"}
          required
          enterkeyhint="done"
          class="input font-mono text-lg tracking-[0.3em]"
          placeholder={selectedMethod === "recovery" ? "XXXXX-XXXXX" : "000000"}
          value={codeInput}
          oninput={(e) =>
            (codeInput = normalizeCodeInput(
              e.currentTarget,
              selectedMethod === "recovery"
                ? RECOVERY_CODE_LENGTH + 1
                : OTP_CODE_LENGTH,
            ))} />
      </label>

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

      {#if verifyMut.error || resendEmailCodeMut.error}
        <Banner variant="error"
          >{verifyMut.error ?? resendEmailCodeMut.error}</Banner>
      {/if}

      <button
        type="submit"
        class="btn btn-primary"
        disabled={verifyMut.loading || !codeInput.trim()}>
        {verifyMut.loading ? m.common_verifying() : m.common_verify()}
      </button>

      <div class="flex items-center justify-between text-sm">
        <button
          type="button"
          class="btn-text"
          onclick={() =>
            availableMethods.filter((mth) => mth !== "recovery").length > 1
              ? (step = "choose-method")
              : backToCredentials()}>
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
</AuthShell>
