<script lang="ts">
  import { goto } from "$app/navigation";
  import { ApiError, deleteAccount } from "$lib/api/client";
  import Modal from "$lib/components/Modal.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";

  let showModal = $state(false);
  let deletePasswordInput = $state("");
  let deleteError = $state("");
  let deleteSaving = $state(false);

  function openDeleteModal() {
    deletePasswordInput = "";
    deleteError = "";
    showModal = true;
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
      deleteError =
        err instanceof ApiError
          ? err.message
          : m.common_delete_error_fallback();
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
    La suppression du compte efface définitivement ton profil, ta bibliothèque,
    ton historique de visionnage et tes notifications. Cette action est
    irréversible.
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
        Ton compte et toutes les données associées — bibliothèque, historique de
        visionnage, notes et notifications — seront définitivement supprimés.
        Cette action ne peut pas être annulée.
      </p>
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
