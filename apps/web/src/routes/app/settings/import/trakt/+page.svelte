<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
</script>

<ImportWizard source="trakt">
  {#snippet intro()}
    Indique ton pseudo Trakt. On récupère ton historique (séries et films vus,
    épisode par épisode) et ta watchlist directement depuis Trakt — rien à
    exporter. Ton profil doit être <strong class="text-fg">public</strong>
    le temps de l'import (<a
      href="https://trakt.tv/settings/privacy"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">réglages de confidentialité ↗</a
    >).
  {/snippet}
</ImportWizard>
