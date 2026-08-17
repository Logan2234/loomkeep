<script lang="ts">
  import { page } from "$app/stores";
  import Banner from "$lib/components/Banner.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";

  const code = $page.url.searchParams.get("code");
  const oauthError = $page.url.searchParams.get("error");
</script>

{#if code}
  <ImportWizard source="simkl" autoInput={code}>
    {#snippet intro()}
      Connexion à Simkl réussie — récupération de ton historique et de ta
      watchlist en cours.
    {/snippet}
  </ImportWizard>
{:else}
  <div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
    <div class="mb-6 flex items-center gap-3">
      <a
        href="/app/settings/import"
        class="text-dim hover:text-fg"
        aria-label={m.common_back()}>
        <Icon name="chevron-left" class="h-5 w-5" />
      </a>
      <h1
        class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        Import Simkl
      </h1>
    </div>
    <Banner variant="error">
      {oauthError === "access_denied"
        ? "Connexion annulée — tu dois autoriser Loomkeep sur Simkl pour importer tes données."
        : "Connexion à Simkl impossible (code manquant). Réessaie depuis la page d'import."}
    </Banner>
    <a href="/app/settings/import/simkl" class="btn btn-primary mt-4">
      Réessayer
    </a>
  </div>
{/if}
