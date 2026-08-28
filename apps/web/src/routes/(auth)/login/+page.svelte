<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { login, resendMfaEmailCode, verifyMfaLogin } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
  import { bannerMessage, fieldError } from "$lib/api/validation-messages";
  import Banner from "$lib/components/Banner.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { MfaMethod } from "@loomkeep/shared";

  let identifier = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let identifierError = $state<string | undefined>();
  let loading = $state(false);

  type Step = "credentials" | "choose-method" | "code";
  let step = $state<Step>("credentials");
  let challengeId = $state("");
  let availableMethods = $state<MfaMethod[]>([]);
  let selectedMethod = $state<MfaMethod>("totp");
  let codeInput = $state("");
  let codeError = $state<string | null>(null);
  let verifying = $state(false);
  let resendCooldown = $state(0);
  let resendTimer: ReturnType<typeof setInterval> | undefined;
  let methodError = $state<string | null>(null);
  let switchingMethod = $state(false);

  // Only follow redirectTo when it's an internal path — anything else could
  // be an open-redirect vector (e.g. redirectTo=https://evil.example).
  function safeRedirect(target: string | null): string {
    if (target?.startsWith("/") && !target.startsWith("//")) return target;
    return "/app";
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    identifierError = undefined;
    loading = true;
    try {
      const result = await login({ identifier, password });
      if (result.mfaRequired) {
        challengeId = result.challengeId;
        availableMethods = result.availableMethods;
        codeInput = "";
        codeError = null;
        const primaryMethods = result.availableMethods.filter(
          (method) => method !== "recovery",
        );
        if (primaryMethods.length === 1) {
          selectedMethod = primaryMethods[0];
          step = "code";
        } else {
          step = "choose-method";
        }
        return;
      }
      await goto(safeRedirect(page.url.searchParams.get("redirectTo")));
    } catch (err) {
      identifierError = fieldError(err, "identifier");
      error = bannerMessage(err, ["identifier"]);
    } finally {
      loading = false;
    }
  }

  // Only the email method needs a send before showing the code screen — TOTP
  // and recovery codes need nothing from the server. Sending here (rather
  // than eagerly for every MFA-enabled login) means an account with both
  // TOTP and email enabled only burns an email send if the user actually
  // picks that method.
  async function chooseMethod(method: MfaMethod) {
    codeInput = "";
    codeError = null;

    if (method === "email") {
      methodError = null;
      switchingMethod = true;
      try {
        await resendMfaEmailCode(challengeId);
      } catch (err) {
        methodError = resolveApiError(err);
        switchingMethod = false;
        return;
      }
      switchingMethod = false;
    }

    selectedMethod = method;
    step = "code";
  }

  async function verifyCode(event: SubmitEvent) {
    event.preventDefault();
    codeError = null;
    verifying = true;
    try {
      await verifyMfaLogin({ challengeId, code: codeInput.trim() });
      await goto(safeRedirect(page.url.searchParams.get("redirectTo")));
    } catch (err) {
      codeError = resolveApiError(err);
    } finally {
      verifying = false;
    }
  }

  async function resendEmailCode() {
    if (resendCooldown > 0) return;
    try {
      await resendMfaEmailCode(challengeId);
      resendCooldown = 30;
      clearInterval(resendTimer);
      resendTimer = setInterval(() => {
        resendCooldown -= 1;
        if (resendCooldown <= 0) {
          clearInterval(resendTimer);
          resendTimer = undefined;
        }
      }, 1000);
    } catch (err) {
      codeError = resolveApiError(err);
    }
  }

  function backToCredentials() {
    step = "credentials";
    password = "";
  }
</script>

<div class="flex min-h-screen flex-col">
  <div class="flex flex-1 items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <p class="font-display text-3xl font-extrabold tracking-tight">
          {m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span>
        </p>
        <p class="text-dim mt-2 text-sm">{m.auth_login_tagline()}</p>
      </div>

      {#if step === "credentials"}
        <form onsubmit={submit} class="card flex flex-col gap-4 p-7">
          <h1 class="font-display text-xl font-bold">{m.auth_login_title()}</h1>
          <input
            type="text"
            placeholder={m.auth_login_identifier_placeholder()}
            bind:value={identifier}
            required
            class="input" />
          {#if identifierError}
            <p class="text-danger -mt-2 text-xs">{identifierError}</p>
          {/if}
          <PasswordInput
            placeholder={m.auth_login_password_placeholder()}
            bind:value={password}
            required />
          <p class="text-dim -mt-2 text-right text-sm">
            <a
              href="/forgot-password"
              class="btn-text btn-text-underline hover:text-accent text-sm"
              >{m.auth_forgot_password()}</a>
          </p>
          {#if error}<Banner variant="error">{error}</Banner>{/if}
          <button type="submit" class="btn btn-primary" disabled={loading}>
            {loading ? m.auth_login_action_loading() : m.auth_login_action()}
          </button>
          {#if appConfig.registrationEnabled}
            <p class="text-dim text-center text-sm">
              {m.auth_no_account()}
              <a
                href="/register"
                class="btn-text btn-text-underline text-accent hover:text-accent text-sm"
                >{m.common_register()}</a>
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
                disabled={switchingMethod}
                onclick={() => chooseMethod("totp")}>
                <Icon name="qr-code" class="text-accent h-6 w-6 shrink-0" />
                <span>
                  <span class="block font-semibold">
                    {m.auth_mfa_choose_method_totp_label()}
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
                disabled={switchingMethod}
                onclick={() => chooseMethod("email")}>
                <Icon name="mail" class="text-accent h-6 w-6 shrink-0" />
                <span>
                  <span class="block font-semibold">
                    {m.auth_mfa_choose_method_email_label()}
                  </span>
                  <span class="text-dim block text-sm">
                    {switchingMethod
                      ? m.auth_mfa_sending_code()
                      : m.auth_mfa_choose_method_email_desc()}
                  </span>
                </span>
              </button>
            {/if}
          </div>
          {#if methodError}<Banner variant="error">{methodError}</Banner>{/if}
          <button
            type="button"
            class="btn-text btn-text-underline text-dim hover:text-fg self-center text-sm"
            onclick={backToCredentials}>
            {m.auth_mfa_back_to_login()}
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
                : m.auth_mfa_code_label()}
            </span>
            <input
              type="text"
              inputmode={selectedMethod === "recovery" ? "text" : "numeric"}
              maxlength={selectedMethod === "recovery" ? 11 : 6}
              class="input font-mono text-lg tracking-[0.3em]"
              placeholder={selectedMethod === "recovery"
                ? "XXXXX-XXXXX"
                : "000000"}
              bind:value={codeInput} />
          </label>

          {#if selectedMethod === "email"}
            <button
              type="button"
              class="btn-text btn-text-underline text-accent hover:text-accent -mt-2 text-left text-sm"
              onclick={resendEmailCode}
              disabled={resendCooldown > 0}>
              {resendCooldown > 0
                ? m.auth_mfa_resend_cooldown({ seconds: resendCooldown })
                : m.auth_mfa_resend_email_code()}
            </button>
          {/if}

          {#if codeError}<Banner variant="error">{codeError}</Banner>{/if}

          <button
            type="submit"
            class="btn btn-primary"
            disabled={verifying || !codeInput.trim()}>
            {verifying
              ? m.auth_mfa_verify_action_loading()
              : m.auth_mfa_verify_action()}
          </button>

          <div class="flex items-center justify-between text-sm">
            <button
              type="button"
              class="btn-text btn-text-underline text-dim hover:text-fg"
              onclick={() =>
                availableMethods.filter((mth) => mth !== "recovery").length > 1
                  ? (step = "choose-method")
                  : backToCredentials()}>
              {m.auth_mfa_back_to_login()}
            </button>
            {#if selectedMethod === "recovery"}
              <button
                type="button"
                class="link-accent"
                onclick={() =>
                  chooseMethod(
                    availableMethods.find((mth) => mth !== "recovery") ??
                      "totp",
                  )}>
                {m.auth_mfa_use_normal_code()}
              </button>
            {:else}
              <button
                type="button"
                class="btn-text btn-text-underline text-accent hover:text-accent text-sm"
                onclick={() => chooseMethod("recovery")}>
                {m.auth_mfa_use_recovery_code()}
              </button>
            {/if}
          </div>
        </form>
      {/if}
    </div>
  </div>
  <LegalLinks />
</div>
