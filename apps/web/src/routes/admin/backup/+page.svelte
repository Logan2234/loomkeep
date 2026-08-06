<script lang="ts">
  import {
    ApiError,
    deleteAdminBackupFile,
    getAdminBackupFile,
    getAdminBackupFiles,
    restoreAdminBackup,
    runAdminJob,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import KpiStrip from "$lib/components/stats/KpiStrip.svelte";
  import { formatBytes } from "$lib/format";
  import { toast } from "$lib/toast.svelte";
  import type { AdminBackupFileDto } from "@tracklore/shared";

  // Mirrors JOB_KEYS.BACKUP in apps/api/src/jobs/job-keys.ts — the daily
  // 3h cron this button also triggers on demand (same code path either way,
  // see BackupService.runScheduled).
  const BACKUP_JOB_KEY = "backup.run";
  const CONFIRM_PHRASE = "RESTAURER";

  let files = $state<AdminBackupFileDto[] | null>(null);
  let loading = $state(true);
  let loadError = $state("");

  let running = $state(false);
  let downloadingId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let pendingDelete = $state<AdminBackupFileDto | null>(null);

  let fileInput = $state<HTMLInputElement | null>(null);
  let pendingFile = $state<File | null>(null);
  let showRestoreModal = $state(false);
  let confirmText = $state("");
  let restoring = $state(false);
  let restoreError = $state("");
  let restoreDone = $state(false);

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function load() {
    loading = true;
    loadError = "";
    try {
      files = await getAdminBackupFiles();
    } catch (err) {
      loadError =
        err instanceof ApiError ? err.message : "Sauvegardes indisponibles";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

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
        medianGapMs === null ? null : (medianGapMs / DAY_MS).toFixed(1),
    };
  });

  const kpis = $derived.by(() => {
    if (!summary) return [];
    const [size, unit] = formatBytes(summary.last.sizeBytes).split(" ");
    return [
      {
        value: dateFmt.format(new Date(summary.last.createdAt)),
        label: "Dernière sauvegarde",
      },
      { value: size, unit, label: "Taille" },
      {
        value: summary.medianGapDays ?? "—",
        unit: summary.medianGapDays === null ? undefined : "j",
        label: "Intervalle médian",
      },
      { value: String(summary.count), label: "Sauvegardes conservées" },
    ];
  });

  async function runNow() {
    running = true;
    try {
      await runAdminJob(BACKUP_JOB_KEY);
      await load();
      toast.success("Sauvegarde générée.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Sauvegarde impossible",
      );
    } finally {
      running = false;
    }
  }

  async function downloadFile(file: AdminBackupFileDto) {
    downloadingId = file.id;
    try {
      const { sql, filename } = await getAdminBackupFile(file.id);
      const blob = new Blob([sql], { type: "application/sql" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Téléchargement impossible",
      );
    } finally {
      downloadingId = null;
    }
  }

  async function confirmDeleteFile() {
    if (!pendingDelete) return;
    deletingId = pendingDelete.id;
    try {
      await deleteAdminBackupFile(pendingDelete.id);
      files = (files ?? []).filter((f) => f.id !== pendingDelete!.id);
      toast.success("Sauvegarde supprimée.");
      pendingDelete = null;
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Suppression impossible",
      );
    } finally {
      deletingId = null;
    }
  }

  function pickFile() {
    fileInput?.click();
  }

  function onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) return;
    pendingFile = file;
    confirmText = "";
    restoreError = "";
    restoreDone = false;
    showRestoreModal = true;
  }

  function closeRestoreModal() {
    if (restoring) return;
    showRestoreModal = false;
    pendingFile = null;
    if (fileInput) fileInput.value = "";
  }

  async function confirmRestore() {
    if (!pendingFile || confirmText !== CONFIRM_PHRASE) return;
    restoring = true;
    restoreError = "";
    try {
      const sql = await pendingFile.text();
      await restoreAdminBackup({ sql });
      restoreDone = true;
      toast.success("Base de données restaurée.");
    } catch (err) {
      restoreError =
        err instanceof ApiError ? err.message : "Restauration impossible";
    } finally {
      restoring = false;
    }
  }
</script>

<div class="mx-auto max-w-2xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="archive"
    title="Sauvegarde"
    subtitle="Sauvegarde automatique quotidienne (3h) de la base de données — les 7 dernières sont conservées.">
    {#snippet actions()}
      <button
        class="btn btn-primary shrink-0"
        disabled={running}
        onclick={runNow}>
        <Icon name="archive" class="mr-1.5 inline h-4 w-4" />
        {running ? "Génération…" : "Sauvegarder maintenant"}
      </button>
    {/snippet}
  </PageHeader>

  {#if summary}
    <KpiStrip tiles={kpis} />
  {/if}

  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-3 text-lg font-bold">Sauvegardes</h2>

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
                {dateFmt.format(new Date(f.createdAt))} · {formatBytes(
                  f.sizeBytes,
                )}
              </p>
            </div>
            <button
              type="button"
              aria-label="Télécharger cette sauvegarde"
              disabled={downloadingId === f.id}
              onclick={() => downloadFile(f)}
              class="text-dim hover:bg-surface-2 hover:text-fg shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-50">
              <Icon name="download" class="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Supprimer cette sauvegarde"
              disabled={deletingId === f.id}
              onclick={() => (pendingDelete = f)}
              class="text-dim hover:bg-danger/10 hover:text-danger shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-50">
              <Icon name="trash" class="h-4 w-4" />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-dim py-6 text-center text-sm">
        Aucune sauvegarde pour l'instant.
      </p>
    {/if}
  </section>

  <section class="card border-danger/40 p-5 md:p-6">
    <h2 class="font-display text-danger mb-1 text-lg font-bold">Restaurer</h2>
    <p class="text-dim mb-4 text-sm">
      Remplace <strong>l'intégralité</strong> de la base de données par le contenu
      d'un fichier de sauvegarde (téléchargé ci-dessus, ou tout autre dump .sql).
      Toute donnée créée depuis cette sauvegarde sera définitivement perdue. Cette
      action est irréversible.
    </p>
    <input
      bind:this={fileInput}
      type="file"
      accept=".sql"
      class="hidden"
      onchange={onFileSelected} />
    <button class="btn btn-danger" onclick={pickFile}>
      Choisir un fichier à restaurer…
    </button>
  </section>
</div>

{#if pendingDelete}
  <ConfirmationModal
    title="Supprimer cette sauvegarde ?"
    message={`${pendingDelete.filename} sera définitivement supprimée du disque.`}
    confirmLabel="Supprimer"
    danger
    busy={deletingId === pendingDelete.id}
    onConfirm={confirmDeleteFile}
    onCancel={() => (pendingDelete = null)} />
{/if}

{#if showRestoreModal && pendingFile}
  <Modal title="Restaurer la sauvegarde" onclose={closeRestoreModal}>
    {#if restoreDone}
      <Banner variant="info">
        Restauration terminée. Recharge la page pour repartir sur les données
        restaurées.
      </Banner>
      <div class="mt-5 flex justify-end">
        <button class="btn btn-primary" onclick={() => location.reload()}>
          Recharger
        </button>
      </div>
    {:else}
      <p class="text-dim text-sm">
        Fichier sélectionné : <strong class="text-fg"
          >{pendingFile.name}</strong>
        ({formatBytes(pendingFile.size)})
      </p>
      <p class="text-dim mt-3 text-sm">
        Cette action écrase <strong>toutes</strong> les données actuelles de
        l'instance, sans retour en arrière possible. Pour confirmer, tape
        <code class="bg-surface-2 rounded px-1.5 py-0.5 text-xs font-bold"
          >{CONFIRM_PHRASE}</code>
        ci-dessous.
      </p>
      <input
        type="text"
        bind:value={confirmText}
        disabled={restoring}
        placeholder={CONFIRM_PHRASE}
        class="border-border bg-surface mt-3 w-full rounded-lg border px-3 py-2 text-sm" />
      {#if restoreError}
        <Banner variant="error" class="mt-3">{restoreError}</Banner>
      {/if}
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          disabled={restoring}
          onclick={closeRestoreModal}>
          Annuler
        </button>
        <button
          type="button"
          class="btn btn-danger"
          disabled={restoring || confirmText !== CONFIRM_PHRASE}
          onclick={confirmRestore}>
          {restoring ? "Restauration…" : "Restaurer définitivement"}
        </button>
      </div>
    {/if}
  </Modal>
{/if}
