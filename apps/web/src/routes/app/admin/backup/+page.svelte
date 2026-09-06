<script lang="ts">
  import {
    deleteAdminBackupFile,
    getAdminBackupFile,
    getAdminBackupFiles,
    restoreAdminBackup,
    runAdminJob,
  } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import { downloadBlob } from "$lib/download";
  import {
    DATETIME_NUMERIC_OPTIONS,
    formatBytes,
    formatDateTime,
    formatNumber,
  } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import type { AdminBackupFileDto } from "@loomkeep/shared";

  // Mirrors JOB_KEYS.BACKUP in apps/api/src/jobs/job-keys.ts — the daily
  // 3h cron this button also triggers on demand (same code path either way,
  // see BackupService.runScheduled).
  const BACKUP_JOB_KEY = "backup.run";
  const CONFIRM_PHRASE = "RESTAURER";

  const filesQuery = createApiQuery(() => ({
    key: keys.admin.backups(),
    fetch: getAdminBackupFiles,
  }));
  const files = $derived(filesQuery.data);
  const loading = $derived(filesQuery.loading);
  const loadError = $derived(filesQuery.error);

  let pendingDelete = $state<AdminBackupFileDto | null>(null);

  let fileInput = $state<HTMLInputElement | null>(null);
  let pendingFile = $state<File | null>(null);
  let showRestoreModal = $state(false);
  let confirmText = $state("");
  let restorePasswordInput = $state("");
  let restoreDone = $state(false);

  const DAY_MS = 24 * 60 * 60 * 1000;

  /**
   * Header figures, derived from the list the page already loaded (7 files at
   * most — an endpoint of its own would only re-fetch what's on screen).
   * "Régularité" is the *median* gap between two consecutive dumps rather than
   * the mean: one manual "Sauvegarder maintenant" a minute after the nightly
   * cron shouldn't make the rhythm look broken.
   */
  const summary = $derived.by(() => {
    if (!files || files.length === 0) return null;

    // listFiles() returns most recent first.
    const gaps = files
      .slice(1)
      .map(
        (f, i) =>
          new Date(files![i].createdAt).getTime() -
          new Date(f.createdAt).getTime(),
      )
      .sort((a, b) => a - b);
    const mid = Math.floor(gaps.length / 2);
    const medianGapMs =
      gaps.length === 0
        ? null
        : gaps.length % 2 === 1
          ? gaps[mid]
          : (gaps[mid - 1] + gaps[mid]) / 2;

    return {
      last: files[0],
      count: files.length,
      medianGapDays:
        medianGapMs === null
          ? null
          : formatNumber(medianGapMs / DAY_MS, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
    };
  });

  const kpis = $derived.by(() => {
    if (!summary) return [];
    const [size, unit] = formatBytes(summary.last.sizeBytes).split(" ");
    return [
      {
        value: formatDateTime(summary.last.createdAt, DATETIME_NUMERIC_OPTIONS),
        label: m.admin_system_last_backup(),
      },
      { value: size, unit, label: m.common_size() },
      {
        value: summary.medianGapDays ?? "—",
        unit:
          summary.medianGapDays === null ? undefined : m.common_days_short(),
        label: m.admin_backup_interval(),
      },
      { value: String(summary.count), label: m.admin_backup_retained() },
    ];
  });

  const runNowMut = createApiMutation(() => ({
    mutate: () => runAdminJob(BACKUP_JOB_KEY),
    invalidates: [keys.admin.backups()],
    successToast: m.admin_backup_created(),
    errorToast: true,
  }));

  function runNow() {
    runNowMut.mutate();
  }

  const downloadMut = createApiMutation(() => ({
    mutate: (file: AdminBackupFileDto) => getAdminBackupFile(file.id),
    errorToast: true,
    onSuccess: ({ content, filename }) => {
      downloadBlob(content, "text/plain", filename);
    },
  }));

  function downloadFile(file: AdminBackupFileDto) {
    downloadMut.mutate(file);
  }

  const deleteMut = createApiMutation(() => ({
    mutate: (file: AdminBackupFileDto) => deleteAdminBackupFile(file.id),
    invalidates: [keys.admin.backups()],
    successToast: m.admin_backup_deleted(),
    errorToast: true,
    onSuccess: () => (pendingDelete = null),
  }));

  function confirmDeleteFile() {
    if (!pendingDelete) return;
    deleteMut.mutate(pendingDelete);
  }

  function pickFile() {
    fileInput?.click();
  }

  function onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) return;
    pendingFile = file;
    confirmText = "";
    restorePasswordInput = "";
    restoreMut.reset();
    restoreDone = false;
    showRestoreModal = true;
  }

  function closeRestoreModal() {
    if (restoreMut.loading) return;
    showRestoreModal = false;
    pendingFile = null;
    restorePasswordInput = "";
    if (fileInput) fileInput.value = "";
  }

  const restoreMut = createApiMutation(() => ({
    mutate: async ({
      file,
      currentPassword,
    }: {
      file: File;
      currentPassword: string;
    }) => restoreAdminBackup({ sql: await file.text(), currentPassword }),
    onSuccess: () => {
      restorePasswordInput = "";
      restoreDone = true;
      toast.success(m.admin_backup_restored());
    },
  }));

  function confirmRestore() {
    if (!pendingFile || confirmText !== CONFIRM_PHRASE) return;
    restoreMut.mutate({
      file: pendingFile,
      currentPassword: restorePasswordInput,
    });
  }
</script>

<div class="mx-auto max-w-2xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="archive"
    title={m.admin_backup_title()}
    subtitle={m.admin_backup_subtitle()}>
    {#snippet actions()}
      <button
        class="btn btn-primary shrink-0"
        disabled={runNowMut.loading}
        onclick={runNow}>
        <Icon name="archive" class="mr-1.5 inline h-4 w-4" />
        {runNowMut.loading
          ? m.admin_backup_generating()
          : m.admin_backup_create()}
      </button>
    {/snippet}
  </PageHeader>

  {#if summary}
    <KpiStrip tiles={kpis} />
  {/if}

  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-3 text-lg font-bold">{m.admin_backups()}</h2>

    {#if loadError}
      <Banner variant="error">{loadError}</Banner>
    {:else if loading}
      <div class="space-y-2">
        {#each { length: 3 } as _, i (i)}
          <div class="skeleton h-12 rounded-lg"></div>
        {/each}
      </div>
    {:else if files && files.length > 0}
      <ul
        class="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {#each files as f (f.id)}
          <li class="flex items-center gap-3 px-3 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="text-fg truncate text-sm font-semibold">
                {f.filename}
              </p>
              <p class="timecode text-xs">
                {formatDateTime(f.createdAt, DATETIME_NUMERIC_OPTIONS)} ·
                {formatBytes(f.sizeBytes)}
              </p>
            </div>
            <button
              type="button"
              aria-label={m.admin_backup_download()}
              disabled={downloadMut.loading &&
                downloadMut.variables?.id === f.id}
              onclick={() => downloadFile(f)}
              class="text-dim hover:bg-surface-2 hover:text-fg shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-50">
              <Icon name="download" class="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={m.admin_backup_delete()}
              disabled={deleteMut.loading && deleteMut.variables?.id === f.id}
              onclick={() => (pendingDelete = f)}
              class="text-dim hover:bg-danger/10 hover:text-danger shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-50">
              <Icon name="trash" class="h-4 w-4" />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-dim py-6 text-center text-sm">
        {m.admin_backup_empty()}
      </p>
    {/if}
  </section>

  <section class="card border-danger/40 p-5 md:p-6">
    <h2 class="font-display text-danger mb-1 text-lg font-bold">
      {m.admin_restore()}
    </h2>
    <p class="text-dim mb-4 text-sm">
      {m.admin_backup_restore_intro()}
      <strong>{m.admin_backup_restore_entire()}</strong>
      {m.admin_backup_restore_encrypted()}<code
        class="bg-surface-2 rounded px-1 py-0.5 text-xs">.sql.age</code
      >{m.admin_backup_restore_decrypt()}<code
        class="bg-surface-2 rounded px-1 py-0.5 text-xs"
        >age -d -o dump.sql fichier.sql.age</code
      >{m.admin_backup_restore_select()}
      <code class="bg-surface-2 rounded px-1 py-0.5 text-xs">.sql</code>
      {m.admin_backup_restore_warning()}
    </p>
    <input
      bind:this={fileInput}
      type="file"
      name="backup"
      accept=".sql"
      class="hidden"
      onchange={onFileSelected} />
    <button class="btn btn-danger" onclick={pickFile}>
      {m.admin_backup_choose_file()}
    </button>
  </section>
</div>

{#if pendingDelete}
  <ConfirmationModal
    title={m.admin_backup_delete_title()}
    message={m.admin_backup_delete_message({
      filename: pendingDelete.filename,
    })}
    confirmLabel={m.common_delete()}
    danger
    busy={deleteMut.loading}
    onConfirm={confirmDeleteFile}
    onCancel={() => (pendingDelete = null)} />
{/if}

{#if showRestoreModal && pendingFile}
  <Modal title={m.admin_backup_restore_title()} onclose={closeRestoreModal}>
    {#if restoreDone}
      <Banner variant="info">
        {m.admin_backup_restored_hint()}
      </Banner>
      <div class="mt-5 flex justify-end">
        <button class="btn btn-primary" onclick={() => location.reload()}>
          {m.common_reload()}
        </button>
      </div>
    {:else}
      <p class="text-dim text-sm">
        {m.admin_backup_selected_file()}
        <strong class="text-fg">{pendingFile.name}</strong>
        ({formatBytes(pendingFile.size)})
      </p>
      <p class="text-dim mt-3 text-sm">
        {m.admin_backup_overwrite_intro()}
        <strong>{m.admin_backup_overwrite_all()}</strong>
        {m.admin_backup_overwrite_warning()}
        <code class="bg-surface-2 rounded px-1.5 py-0.5 text-xs font-bold"
          >{CONFIRM_PHRASE}</code>
        {m.admin_confirmation_below()}
      </p>
      <input
        type="text"
        name="confirmation"
        bind:value={confirmText}
        disabled={restoreMut.loading}
        placeholder={CONFIRM_PHRASE}
        class="border-border bg-surface mt-3 w-full rounded-lg border px-3 py-2 text-sm" />
      <label class="mt-3 block">
        <span class="mb-1.5 block text-sm font-semibold">
          {m.common_current_password()}
        </span>
        <PasswordInput
          name="currentPassword"
          autocomplete="current-password"
          enterkeyhint="done"
          minlength={1}
          required
          bind:value={restorePasswordInput} />
      </label>
      {#if restoreMut.error}
        <Banner variant="error" class="mt-3">{restoreMut.error}</Banner>
      {/if}
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={restoreMut.loading}
          onclick={closeRestoreModal}>
          {m.common_cancel()}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          disabled={restoreMut.loading ||
            confirmText !== CONFIRM_PHRASE ||
            !restorePasswordInput}
          onclick={confirmRestore}>
          {restoreMut.loading
            ? m.admin_backup_restoring()
            : m.admin_backup_restore_confirm()}
        </button>
      </div>
    {/if}
  </Modal>
{/if}
