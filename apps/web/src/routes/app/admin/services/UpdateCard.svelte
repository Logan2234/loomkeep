<script lang="ts">
  import {
    checkAdminUpdate,
    getAdminBackupFiles,
    getAdminUpdateStatus,
    runAdminJob,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { CopyFeedback } from "#lib/clipboard.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { CHANGELOG_URL } from "#lib/constants/external-links.js";
  import { formatDateTime, formatTime } from "#lib/format.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { AdminUpdateStatusDto } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { fade } from "svelte/transition";

  const UPDATE_COMMAND = "docker compose pull && docker compose up -d";
  const reduced = prefersReducedMotion();
  const queryClient = useQueryClient();
  const copyFeedback = new CopyFeedback();

  const updateQuery = createApiQuery(() => ({
    key: keys.admin.update(),
    fetch: getAdminUpdateStatus,
  }));
  const status = $derived(updateQuery.data);

  const backupsQuery = createApiQuery(() => ({
    key: keys.admin.backups(),
    fetch: getAdminBackupFiles,
    enabled: !!status?.updateAvailable,
  }));
  const latestBackup = $derived(
    (backupsQuery.data?.files ?? [])
      .filter((file) => file.status === "AVAILABLE")
      .reduce<string | null>(
        (latest, file) =>
          !latest || file.createdAt > latest ? file.createdAt : latest,
        null,
      ),
  );

  const checkMut = createApiMutation<void, AdminUpdateStatusDto>(() => ({
    mutate: checkAdminUpdate,
    onSuccess: (data) => queryClient.setQueryData(keys.admin.update(), data),
    errorToast: true,
  }));

  const backupMut = createApiMutation(() => ({
    mutate: () => runAdminJob("backup.run"),
    invalidates: [keys.admin.backups()],
    successToast: m.admin_update_backup_done(),
    errorToast: true,
  }));
</script>

{#if status?.enabled}
  {#if status.updateAvailable && status.latestVersion}
    <section
      class="card border-accent mb-6 flex flex-col gap-4 p-5 md:p-6"
      in:fade={{ duration: reduced ? 0 : 200 }}
      aria-labelledby="admin-update-title">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="bg-accent text-accent-fg rounded-full px-2 py-0.5 text-[0.6rem] font-bold tracking-wide uppercase">
              {m.admin_update_badge()}
            </span>
            {#if isFeatureNew("update-check")}<NewBadge />{/if}
            <span class="timecode text-sm">
              v{status.currentVersion} → v{status.latestVersion}
            </span>
          </div>
          <h2 id="admin-update-title" class="font-display text-xl font-bold">
            {m.admin_update_title({ version: status.latestVersion })}
          </h2>
          <p class="text-dim text-sm">
            {m.admin_update_running({ version: status.currentVersion })}
            {#if status.checkedAt}
              {m.admin_update_checked_at({
                time: formatDateTime(status.checkedAt),
              })}
            {/if}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a
            class="btn btn-primary"
            href={CHANGELOG_URL}
            target="_blank"
            rel="noopener noreferrer">
            {m.admin_update_changelog()}
            <Icon name="external" class="h-4 w-4" />
          </a>
          <button
            type="button"
            class="btn btn-ghost"
            disabled={checkMut.loading}
            onclick={() => checkMut.mutate()}>
            {checkMut.loading ? m.common_loading() : m.admin_update_check()}
          </button>
        </div>
      </div>

      <ol class="grid gap-3 md:grid-cols-2">
        <li
          class="bg-bg border-surface-2 flex flex-col items-start gap-2.5 rounded-xl border p-4">
          <p class="timecode text-micro tracking-wide uppercase">
            1 · {m.admin_update_step_backup()}
          </p>
          <p class="text-sm">
            {latestBackup
              ? m.admin_update_last_backup({
                  date: formatDateTime(latestBackup),
                })
              : m.admin_no_backups()}
          </p>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            disabled={backupMut.loading}
            onclick={() => backupMut.mutate()}>
            {backupMut.loading
              ? m.common_loading()
              : m.admin_update_backup_now()}
          </button>
        </li>
        <li
          class="bg-bg border-surface-2 flex min-w-0 flex-col gap-2.5 rounded-xl border p-4">
          <p class="timecode text-micro tracking-wide uppercase">
            2 · {m.admin_update_step_update()}
          </p>
          <p class="text-sm">{m.admin_update_command_hint()}</p>
          <div
            class="bg-fg text-bg flex min-w-0 items-center gap-2 rounded-lg py-2 pr-2 pl-3">
            <code class="min-w-0 flex-1 overflow-x-auto font-mono text-xs"
              >{UPDATE_COMMAND}</code>
            <button
              type="button"
              class="btn btn-primary btn-sm shrink-0"
              onclick={() => copyFeedback.copy(UPDATE_COMMAND, true)}>
              {copyFeedback.value ? m.common_copied() : m.common_copy()}
            </button>
          </div>
        </li>
      </ol>

      <p class="text-dim text-xs">{m.admin_update_privacy()}</p>
    </section>
  {:else}
    <div
      class="card mb-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full px-4 py-2 text-sm">
      <span
        class="h-2 w-2 rounded-full {status.lastCheckFailed
          ? 'bg-warning'
          : status.latestVersion === null
            ? 'bg-dim'
            : 'bg-success'}"
        aria-hidden="true"></span>
      <span>
        {status.lastCheckFailed
          ? m.admin_update_check_failed()
          : status.latestVersion === null
            ? m.admin_update_not_checked()
            : m.admin_update_up_to_date()}
      </span>
      <span class="timecode text-xs">
        v{status.currentVersion}{#if status.checkedAt}
          · {m.admin_update_checked_short({
            time: formatTime(status.checkedAt),
          })}{/if}
      </span>
      <button
        type="button"
        class="link-accent text-xs font-semibold"
        disabled={checkMut.loading}
        onclick={() => checkMut.mutate()}>
        {checkMut.loading ? m.common_loading() : m.admin_update_check()}
      </button>
    </div>
  {/if}
{/if}
