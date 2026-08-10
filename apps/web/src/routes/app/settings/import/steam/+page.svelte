<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { IMPORT_SOURCES } from "$lib/import/sources";
</script>

<ImportWizard descriptor={IMPORT_SOURCES.steam}>
  {#snippet intro()}
    Récupère ta bibliothèque et ton temps de jeu Steam. Ton profil et les
    détails des jeux doivent être <strong class="text-fg">publics</strong> le
    temps de l'import (<a
      href="https://steamcommunity.com/my/edit/settings"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">réglages de confidentialité ↗</a
    >). Le SteamID64 se trouve via un outil comme
    <a
      href="https://steamid.io"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">steamid.io ↗</a> si ton profil n'a pas d'URL personnalisée.
  {/snippet}
</ImportWizard>
