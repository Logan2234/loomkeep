<script lang="ts">
  import {
    confirmReauth,
    confirmReauthWithPasskey,
    getReauthStatus,
  } from "#lib/api/client.js";
  import { ApiError } from "#lib/api/core.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
  import { readStorage, writeStorage } from "#lib/local-storage.js";
  import type { IconName } from "#lib/types/icon-name.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { normalizeCodeInput } from "#lib/one-time-code.js";
  import { m } from "#lib/paraglide/messages.js";
  import { reauth } from "#lib/reauth.svelte.js";
  import {
    ErrorCode,
    OTP_CODE_LENGTH,
    type ReauthMethod,
    type ReauthResultDto,
  } from "@loomkeep/shared";
  import { fly, scale } from "svelte/transition";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import PasswordInput from "./PasswordInput.svelte";

  let { reason }: { reason: string } = $props();

  const reduced = prefersReducedMotion();

  const ICONS: Record<ReauthMethod, IconName> = {
    webauthn: "key",
    totp: "qr-code",
    password: "lock",
  };
  const NAMES: Record<ReauthMethod, () => string> = {
    webauthn: m.common_security_key,
    totp: m.auth_mfa_totp_label,
    password: m.common_password,
  };
  const DESCRIPTIONS: Record<ReauthMethod, () => string> = {
    webauthn: m.auth_mfa_choose_method_webauthn_desc,
    totp: m.auth_mfa_choose_method_totp_desc,
    password: m.reauth_password_desc,
  };

  const statusQuery = createApiQuery(() => ({
    key: keys.mfa.reauth(),
    fetch: getReauthStatus,
  }));
  const methods = $derived(statusQuery.data?.methods ?? []);

  // The last method used comes back first; otherwise the strongest one.
  let chosen = $state<ReauthMethod | null>(null);
  const method = $derived.by((): ReauthMethod | null => {
    if (chosen) return chosen;
    const last = readStorage(STORAGE_KEYS.reauthMethod);
    return methods.find((option) => option === last) ?? methods[0] ?? null;
  });
  let showOthers = $state(false);
  const others = $derived(methods.filter((option) => option !== method));

  let code = $state("");
  let password = $state("");
  let passkeyCancelled = $state(false);
  let lockedOut = $state(false);
  let done = $state(false);

  const confirmMut = createApiMutation(() => ({
    mutate: (proof: ReauthMethod): Promise<ReauthResultDto> =>
      proof === "webauthn"
        ? confirmReauthWithPasskey()
        : proof === "totp"
          ? confirmReauth({ method: "totp", code })
          : confirmReauth({ method: "password", password }),
    onSuccess: ({ confirmedUntil }, proof) => {
      writeStorage(STORAGE_KEYS.reauthMethod, proof);
      done = true;
      setTimeout(() => reauth.confirmed(confirmedUntil), reduced ? 0 : 600);
    },
    onError: (err) => {
      // The browser's own prompt was closed: nothing went wrong server-side.
      passkeyCancelled = err instanceof DOMException;
      lockedOut =
        err instanceof ApiError &&
        err.code === ErrorCode.AuthReauthTooManyAttempts;
      code = "";
    },
  }));

  const error = $derived(
    passkeyCancelled ? m.reauth_webauthn_cancelled() : confirmMut.error,
  );

  function pick(next: ReauthMethod) {
    chosen = next;
    showOthers = false;
    passkeyCancelled = false;
    confirmMut.reset();
  }

  function submit(proof: ReauthMethod) {
    passkeyCancelled = false;
    confirmMut.mutate(proof);
  }

  function close() {
    if (done) return;
    reauth.cancelled();
    // The session was signed out server-side: back to the sign-in page.
    if (lockedOut) auth.clear();
  }
</script>

<Modal title={m.reauth_title()} description={reason} onclose={close}>
  {#if done}
    <div
      class="flex flex-col items-center gap-2 py-4 text-center"
      role="status">
      <span
        class="bg-success/15 text-success grid h-14 w-14 place-items-center rounded-full"
        in:scale={{ duration: reduced ? 0 : 200, start: 0.8 }}>
        <Icon name="check" class="h-7 w-7" />
      </span>
      <p class="font-display text-lg font-bold">{m.reauth_done()}</p>
    </div>
  {:else if lockedOut}
    <p class="text-danger text-sm" role="alert">{error}</p>
    <div class="mt-4 flex justify-end">
      <button type="button" class="btn btn-primary" onclick={close}>
        {m.reauth_sign_in_again()}
      </button>
    </div>
  {:else if method}
    {#key method}
      <div
        class="flex flex-col gap-3"
        in:fly={{ x: 10, duration: reduced ? 0 : 200 }}>
        {#if method === "webauthn"}
          <div
            class="border-border flex items-center gap-3 rounded-xl border p-3.5">
            <span
              class="bg-accent/15 text-accent relative grid h-11 w-11 shrink-0 place-items-center rounded-full {confirmMut.loading
                ? 'animate-pulse'
                : ''}">
              <Icon name="key" class="h-5 w-5" />
            </span>
            <span class="min-w-0">
              <span class="block font-semibold">{m.common_security_key()}</span>
              <span class="text-dim block text-sm">
                {confirmMut.loading
                  ? m.auth_mfa_webauthn_waiting()
                  : m.reauth_webauthn_hint()}
              </span>
            </span>
          </div>
          <button
            type="button"
            class="btn btn-primary w-full"
            disabled={confirmMut.loading}
            onclick={() => submit("webauthn")}>
            {m.reauth_webauthn_use()}
          </button>
        {:else if method === "totp"}
          <label class="block">
            <span class="mb-1.5 block text-sm font-semibold">
              {m.common_code()}
            </span>
            <!-- svelte-ignore a11y_autofocus -->
            <input
              type="text"
              name="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              enterkeyhint="done"
              autofocus
              class="input font-mono text-lg tracking-[0.3em]"
              placeholder="000000"
              aria-describedby="reauth-code-hint"
              disabled={confirmMut.loading}
              value={code}
              oninput={(e) => {
                code = normalizeCodeInput(e.currentTarget, OTP_CODE_LENGTH);
                if (code.length === OTP_CODE_LENGTH) submit("totp");
              }} />
          </label>
          <p id="reauth-code-hint" class="text-dim text-sm">
            {m.auth_mfa_code_totp_hint()}
          </p>
        {:else}
          <form
            class="flex flex-col gap-3"
            onsubmit={(e) => {
              e.preventDefault();
              submit("password");
            }}>
            <label class="block">
              <span class="mb-1.5 block text-sm font-semibold">
                {m.common_current_password()}
              </span>
              <PasswordInput
                name="currentPassword"
                autocomplete="current-password"
                enterkeyhint="done"
                required
                bind:value={password} />
            </label>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn btn-ghost" onclick={close}>
                {m.common_cancel()}
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                disabled={confirmMut.loading || !password}>
                {m.common_confirm()}
              </button>
            </div>
          </form>
        {/if}
      </div>
    {/key}

    {#if error}
      <p class="text-danger mt-3 text-sm" role="alert">{error}</p>
    {/if}

    <p
      class="bg-surface-2 text-dim mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs">
      <Icon name="timer" class="text-accent mt-px h-4 w-4 shrink-0" />
      {m.reauth_window_note()}
    </p>

    {#if others.length > 0}
      {#if showOthers}
        <div
          class="mt-3 flex flex-col gap-2"
          in:fly={{ y: -6, duration: reduced ? 0 : 180 }}>
          <p class="text-dim text-xs font-semibold">
            {m.reauth_other_methods()}
          </p>
          {#each others as other (other)}
            <button
              type="button"
              class="border-border hover:border-accent hover:bg-accent/5 flex items-center gap-3 rounded-xl border p-3 text-left transition-colors"
              onclick={() => pick(other)}>
              <Icon name={ICONS[other]} class="text-accent h-5 w-5 shrink-0" />
              <span class="min-w-0">
                <span class="block text-sm font-semibold"
                  >{NAMES[other]()}</span>
                <span class="text-dim block text-xs">
                  {DESCRIPTIONS[other]()}
                </span>
              </span>
            </button>
          {/each}
        </div>
      {:else}
        <button
          type="button"
          class="link-accent mt-3 text-sm"
          onclick={() => (showOthers = true)}>
          {m.reauth_other_method()}
        </button>
      {/if}
    {/if}
  {:else}
    <div class="bg-surface-2 h-24 animate-pulse rounded-xl"></div>
  {/if}
</Modal>
