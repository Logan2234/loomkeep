<script lang="ts">
  import { ApiError, forgotPassword } from "$lib/api/client";

  let email = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);
  let submitted = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    loading = true;
    try {
      await forgotPassword(email);
      submitted = true;
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : "Impossible de générer le lien";
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
      <p class="text-dim mt-2 text-sm">Mot de passe oublié.</p>
    </div>

    <div class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">
        Réinitialiser le mot de passe
      </h1>

      {#if !submitted}
        <p class="text-dim text-sm">
          Indique l'email de ton compte. Si un compte existe, un lien de
          réinitialisation (valable 1h) va t'être envoyé par email.
        </p>
        <form onsubmit={submit} class="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            bind:value={email}
            required
            class="input" />
          {#if error}<p class="text-danger text-sm">{error}</p>{/if}
          <button type="submit" class="btn btn-primary" disabled={loading}>
            {loading ? "Envoi…" : "Envoyer le lien"}
          </button>
        </form>
      {:else}
        <p class="text-dim text-sm">
          Si un compte existe avec cet email, un lien de réinitialisation vient
          d'être envoyé.
        </p>
      {/if}

      <p class="text-dim text-center text-sm">
        <a href="/login" class="link-accent">Retour à la connexion</a>
      </p>
    </div>
  </div>
</div>
