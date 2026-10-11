<script lang="ts">
  import Modal from "#lib/components/Modal.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { CopyFeedback } from "#lib/clipboard.svelte.js";
  import { downloadBlob, datedFilename } from "#lib/download.js";
  import { formatDate } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import { RECOVERY_CODE_LENGTH } from "@loomkeep/shared";
  let {
    codes,
    accountEmail,
    onclose,
  }: { codes: string[]; accountEmail: string; onclose: () => void } = $props();
  const copyFeedback = new CopyFeedback();
  const recoveryCopied = $derived(copyFeedback.value === true);
  $effect(() => () => copyFeedback.reset());
  async function copyAllCodes() {
    await copyFeedback.copy(codes.join("\n"), true);
  }

  const groupCode = (code: string): string =>
    `${code.slice(0, RECOVERY_CODE_LENGTH / 2)}-${code.slice(RECOVERY_CODE_LENGTH / 2)}`;

  /**
   * Plain text rather than PDF: it needs no dependency, prints fine, and is
   * readable from a password manager's secure note — which is where these
   * belong. Shown once and never again, so a copy-to-clipboard alone loses
   * them to the next thing the user copies.
   */
  function downloadCodes() {
    const header = [
      m.settings_mfa_recovery_file_header({ account: accountEmail }),
      m.settings_mfa_recovery_file_generated({
        date: formatDate(new Date().toISOString()),
      }),
      "",
    ];
    downloadBlob(
      [...header, ...codes.map(groupCode), ""].join("\r\n"),
      "text/plain;charset=utf-8",
      datedFilename(`loomkeep-recovery-codes`, "txt"),
    );
  }
</script>

<Modal title={m.settings_mfa_recovery_reveal_title()} {onclose}>
  <p class="text-dim mb-4 text-sm">{m.settings_mfa_recovery_reveal_hint()}</p>
  <div
    class="border-border bg-surface-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-dashed p-4">
    {#each codes as code (code)}
      <p class="text-center font-mono text-sm tracking-wider tabular-nums">
        {groupCode(code)}
      </p>
    {/each}
  </div>
  <div class="mt-4 flex flex-col gap-2">
    <button class="btn btn-ghost w-full" onclick={copyAllCodes}>
      <Icon name={recoveryCopied ? "check" : "link"} class="h-4 w-4" />
      {recoveryCopied ? m.common_copied() : m.settings_mfa_recovery_copy_all()}
    </button>
    <button class="btn btn-ghost w-full" onclick={downloadCodes}>
      <Icon name="download" class="h-4 w-4" />
      {m.settings_mfa_recovery_download()}
    </button>
    <button class="btn btn-primary w-full" onclick={onclose}>
      {m.settings_mfa_recovery_acknowledge()}
    </button>
  </div>
</Modal>
