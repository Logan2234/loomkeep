<script lang="ts">
  import Modal from "#lib/components/Modal.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { normalizeCodeInput } from "#lib/one-time-code.js";
  import { OTP_CODE_LENGTH } from "@loomkeep/shared";
  let {
    step = $bindable<"scan" | "confirm">("scan"),
    code = $bindable(""),
    qrSvg,
    secret,
    busy,
    invalid,
    onconfirm,
    onclose,
  }: {
    step?: "scan" | "confirm";
    code?: string;
    qrSvg: string;
    secret: string;
    busy: boolean;
    invalid: boolean;
    onconfirm: () => void;
    onclose: () => void;
  } = $props();
</script>

<Modal title={m.settings_mfa_totp_setup_title()} {onclose}>
  {#if step === "scan"}
    <div class="flex flex-col items-center gap-4">
      {#if qrSvg}
        <div class="qr-frame rounded-xl bg-white p-3">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html qrSvg}
        </div>
      {:else}
        <div class="bg-surface-2 h-48 w-48 animate-pulse rounded-xl"></div>
      {/if}
      <p class="text-dim max-w-xs text-center text-sm">
        {m.settings_mfa_totp_scan_hint()}
      </p>
      {#if secret}
        <p class="w-full text-center">
          <span class="text-dim text-xs"
            >{m.settings_mfa_totp_manual_entry_label()}</span>
          <span class="block font-mono text-sm tracking-widest select-all">
            {secret}
          </span>
        </p>
      {/if}
      <button
        type="button"
        class="btn btn-primary w-full"
        disabled={!qrSvg}
        onclick={() => (step = "confirm")}>
        {m.common_next()}
      </button>
    </div>
  {:else}
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        onconfirm();
      }}>
      <p class="text-sm">{m.settings_mfa_totp_confirm_hint()}</p>
      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">
          {m.common_code()}
        </span>
        <input
          type="text"
          name="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          minlength={OTP_CODE_LENGTH}
          required
          enterkeyhint="done"
          class="input font-mono text-lg tracking-[0.3em]"
          placeholder="000000"
          value={code}
          oninput={(e) =>
            (code = normalizeCodeInput(e.currentTarget, OTP_CODE_LENGTH))} />
      </label>
      {#if invalid}
        <p class="text-danger text-sm">
          {m.settings_mfa_totp_invalid_code()}
        </p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => (step = "scan")}>
          {m.common_back()}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={busy || code.trim().length !== OTP_CODE_LENGTH}>
          {busy ? m.common_save_loading() : m.common_enable()}
        </button>
      </div>
    </form>
  {/if}
</Modal>

<style>
  .qr-frame :global(svg) {
    width: 200px;
    height: 200px;
  }
</style>
