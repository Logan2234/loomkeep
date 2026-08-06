<script lang="ts">
  import { goto } from "$app/navigation";
  import { ApiError, login } from "$lib/api/client";
  import PasswordInput from "$lib/components/PasswordInput.svelte";

  let identifier = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    loading = true;
    try {
      await login({ identifier, password });
      await goto("/");
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Connexion impossible";
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
      <p class="text-dim mt-2 text-sm">Ta salle de projection privée.</p>
    </div>

    <form onsubmit={submit} class="card flex flex-col gap-4 p-7">
      <h1 class="font-display text-xl font-bold">Connexion</h1>
      <input
        type="text"
        placeholder="Email ou nom d'utilisateur"
        bind:value={identifier}
        required
        class="input" />
      <PasswordInput
        placeholder="Mot de passe"
        bind:value={password}
        required />
      <a
        href="/forgot-password"
        class="text-dim hover:text-accent -mt-2 text-right text-sm hover:underline"
        >Mot de passe oublié ?</a>
      {#if error}<p class="text-danger text-sm">{error}</p>{/if}
      <button type="submit" class="btn btn-primary" disabled={loading}>
        {loading ? "Connexion…" : "Se connecter"}
      </button>
      <p class="text-dim text-center text-sm">
        Pas encore de compte ?
        <a href="/register" class="link-accent">Créer un compte</a>
      </p>
    </form>
  </div>
</div>
