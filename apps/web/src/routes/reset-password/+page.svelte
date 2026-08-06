<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { ApiError, resetPassword } from "$lib/api/client";
  import PasswordInput from "$lib/components/PasswordInput.svelte";

  const token = $page.url.searchParams.get("token") ?? "";

  let newPassword = $state("");
  let confirmPassword = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;

    if (newPassword !== confirmPassword) {
      error = "Les mots de passe ne correspondent pas";
      return;
    }

    loading = true;
    try {
      await resetPassword(token, newPassword);
      await goto("/login");
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Réinitialisation impossible";
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <p class="font-display text-3xl font-extrabold tracking-tight">
        LOOM<span class="text-accent">KEEP</span>
      </p>
    </div>

    <div class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">Nouveau mot de passe</h1>

      {#if !token}
        <p class="text-danger text-sm">
          Lien invalide : aucun token trouvé dans l'URL.
        </p>
      {:else}
        <form onsubmit={submit} class="flex flex-col gap-4">
          <PasswordInput
            placeholder="Nouveau mot de passe (8 caractères min.)"
            bind:value={newPassword}
            minlength={8}
            required />
          <PasswordInput
            placeholder="Confirmer le mot de passe"
            bind:value={confirmPassword}
            minlength={8}
            required />
          {#if error}<p class="text-danger text-sm">{error}</p>{/if}
          <button type="submit" class="btn btn-primary" disabled={loading}>
            {loading ? "Enregistrement…" : "Réinitialiser"}
          </button>
        </form>
      {/if}

      <p class="text-dim text-center text-sm">
        <a href="/login" class="link-accent">Retour à la connexion</a>
      </p>
    </div>
  </div>
</div>
