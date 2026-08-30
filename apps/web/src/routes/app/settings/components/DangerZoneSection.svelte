<script lang="ts">
  import { goto } from "$app/navigation";
  import { deleteAccount, getAccountDeletionSummary } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import {
    type AccountDeletionAnonymizedCategory,
    type AccountDeletionDeletedCategory,
  } from "@loomkeep/shared";

  const DELETED_LABELS: Record<AccountDeletionDeletedCategory, string> = {
    LIBRARY: m.settings_delete_account_library_media(),
    WATCH_HISTORY: m.settings_delete_account_watch_history(),
    GAMES: m.settings_delete_account_games(),
    BOOKS: m.settings_delete_account_books(),
    MUSIC: m.settings_delete_account_music(),
    LISTS: m.settings_delete_account_lists(),
    NOTIFICATIONS: m.settings_delete_account_notifications(),
    FOLLOWS: m.settings_delete_account_follows(),
    BLOCKS: m.settings_delete_account_blocks(),
    ACTIVITY: m.settings_delete_account_activity(),
  };

  const ANONYMIZED_LABELS: Record<AccountDeletionAnonymizedCategory, string> = {
    REVIEWS: m.settings_delete_account_reviews(),
    COMMENTS: m.settings_delete_account_comments(),
    REPORTS: m.settings_delete_account_reports(),
  };

  let showModal = $state(false);
  let deletePasswordInput = $state("");

  const summaryQuery = createApiQuery(() => ({
    key: keys.account.deletionSummary(),
    fetch: getAccountDeletionSummary,
    enabled: showModal,
  }));
  const summary = $derived(summaryQuery.data);
  const summaryLoading = $derived(summaryQuery.loading);

  function openDeleteModal() {
    deletePasswordInput = "";
    deleteMut.reset();
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  const deleteMut = createApiMutation(() => ({
    mutate: () => deleteAccount({ currentPassword: deletePasswordInput }),
    coveredFields: ["currentPassword"],
    onSuccess: () => {
      toast.success(m.settings_delete_account_success());
      void goto("/login");
    },
  }));

  function confirmDeleteAccount() {
    deleteMut.mutate();
  }
</script>

<section class="card border-danger/40 p-5 md:p-6">
  <h2 class="font-display text-danger mb-1 text-lg font-bold">
    {m.settings_danger_zone_title()}
  </h2>
  <p class="text-dim mb-4 text-sm">
    {m.settings_delete_account_description()}
  </p>
  <button class="btn btn-danger" onclick={openDeleteModal}>
    {m.settings_delete_account_button()}
  </button>
</section>

{#if showModal}
  <Modal title={m.settings_delete_account_modal_title()} onclose={closeModal}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        confirmDeleteAccount();
      }}>
      <p class="text-dim text-sm">
        {m.settings_delete_account_modal_description()}
      </p>

      <details class="border-border rounded-lg border">
        <summary
          class="text-dim hover:text-fg cursor-pointer px-3 py-2 text-sm select-none">
          {m.settings_delete_account_details_summary()}
        </summary>
        <div class="border-border space-y-3 border-t px-3 py-3 text-sm">
          {#if summaryLoading}
            <p class="text-dim">{m.common_loading()}</p>
          {:else if !summary}
            <p class="text-dim">
              {m.settings_delete_account_details_unavailable()}
            </p>
          {:else}
            <div>
              <p class="mb-1 font-semibold">
                {m.settings_delete_account_deleted_heading()}
              </p>
              <ul class="text-dim space-y-0.5">
                {#each summary.deleted as row (row.category)}
                  <li class="flex items-center justify-between gap-2">
                    <span>{DELETED_LABELS[row.category]}</span>
                    <span class="tabular-nums">{row.count}</span>
                  </li>
                {/each}
              </ul>
            </div>
            <div>
              <p class="mb-1 font-semibold">
                {m.settings_delete_account_anonymized_heading()}
              </p>
              <ul class="text-dim space-y-0.5">
                {#each summary.anonymized as row (row.category)}
                  <li class="flex items-center justify-between gap-2">
                    <span>{ANONYMIZED_LABELS[row.category]}</span>
                    <span class="tabular-nums">{row.count}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      </details>

      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">
          {m.settings_delete_account_password_label()}
        </span>
        <PasswordInput
          autocomplete="current-password"
          bind:value={deletePasswordInput} />
      </label>
      {#if deleteMut.error}
        <p class="text-danger text-sm">{deleteMut.error}</p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" onclick={closeModal}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-danger"
          disabled={deleteMut.loading || !deletePasswordInput}>
          {deleteMut.loading
            ? m.settings_delete_account_deleting()
            : m.settings_delete_account_confirm()}
        </button>
      </div>
    </form>
  </Modal>
{/if}
