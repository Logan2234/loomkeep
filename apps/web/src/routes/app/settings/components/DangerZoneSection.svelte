<script lang="ts">
  import { goto } from "$app/navigation";
  import { deleteAccount, getAccountDeletionSummary } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
  import Modal from "$lib/components/Modal.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import {
    type AccountDeletionAnonymizedCategory,
    type AccountDeletionDeletedCategory,
    type AccountDeletionSummaryDto,
  } from "@loomkeep/shared";

  const DELETED_LABELS: Record<AccountDeletionDeletedCategory, string> = {
    LIBRARY: "Bibliothèque films/séries",
    WATCH_HISTORY: "Historique de visionnage",
    GAMES: "Bibliothèque jeux",
    BOOKS: "Bibliothèque livres",
    MUSIC: "Bibliothèque musique",
    LISTS: "Listes personnalisées",
    NOTIFICATIONS: "Notifications",
    FOLLOWS: "Abonnements (suivis et suiveurs)",
    BLOCKS: "Utilisateurs bloqués",
    ACTIVITY: "Fil d'activité",
  };

  const ANONYMIZED_LABELS: Record<AccountDeletionAnonymizedCategory, string> = {
    REVIEWS: "Notes et avis",
    COMMENTS: "Commentaires",
    REPORTS: "Signalements déposés",
  };

  let showModal = $state(false);
  let deletePasswordInput = $state("");
  let deleteError = $state("");
  let deleteSaving = $state(false);
  let summary = $state<AccountDeletionSummaryDto | null>(null);
  let summaryLoading = $state(false);

  function openDeleteModal() {
    deletePasswordInput = "";
    deleteError = "";
    showModal = true;
    summary = null;
    summaryLoading = true;
    getAccountDeletionSummary()
      .then((s) => (summary = s))
      .catch(() => (summary = null))
      .finally(() => (summaryLoading = false));
  }

  function closeModal() {
    showModal = false;
  }

  async function confirmDeleteAccount() {
    deleteError = "";
    deleteSaving = true;
    try {
      await deleteAccount({ currentPassword: deletePasswordInput });
      toast.success("Compte supprimé.");
      await goto("/login");
    } catch (err) {
      deleteError = resolveApiError(err);
    } finally {
      deleteSaving = false;
    }
  }
</script>

<section class="card border-danger/40 p-5 md:p-6">
  <h2 class="font-display text-danger mb-1 text-lg font-bold">
    Zone de danger
  </h2>
  <p class="text-dim mb-4 text-sm">
    La suppression du compte efface définitivement ton profil et toutes les
    données associées. Tes notes, commentaires et signalements restent visibles
    mais deviennent anonymes. <span class="font-semibold"
      >Cette action est irréversible</span> !
  </p>
  <button class="btn btn-danger" onclick={openDeleteModal}>
    Supprimer mon compte
  </button>
</section>

{#if showModal}
  <Modal title="Supprimer le compte" onclose={closeModal}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        confirmDeleteAccount();
      }}>
      <p class="text-dim text-sm">
        Ton compte, ton profil et toutes les données qui t'appartiennent en
        propre seront définitivement supprimés. Tes notes, commentaires et
        signalements resteront visibles mais seront détachés de ton identité («
        Utilisateur supprimé »). Cette action ne peut pas être annulée.
      </p>

      <details class="border-border rounded-lg border">
        <summary
          class="text-dim hover:text-fg cursor-pointer px-3 py-2 text-sm select-none">
          Voir le détail de ce qui sera supprimé et anonymisé
        </summary>
        <div class="border-border space-y-3 border-t px-3 py-3 text-sm">
          {#if summaryLoading}
            <p class="text-dim">{m.common_loading()}</p>
          {:else if !summary}
            <p class="text-dim">Détail indisponible pour le moment.</p>
          {:else}
            <div>
              <p class="mb-1 font-semibold">Supprimé définitivement</p>
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
                Anonymisé (conservé sans ton identité)
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
          Confirme avec ton mot de passe
        </span>
        <PasswordInput
          autocomplete="current-password"
          bind:value={deletePasswordInput} />
      </label>
      {#if deleteError}
        <p class="text-danger text-sm">{deleteError}</p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" onclick={closeModal}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          class="btn btn-danger"
          disabled={deleteSaving || !deletePasswordInput}>
          {deleteSaving ? "Suppression…" : "Supprimer définitivement"}
        </button>
      </div>
    </form>
  </Modal>
{/if}
