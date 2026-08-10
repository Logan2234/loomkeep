<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { IMPORT_SOURCES } from "$lib/import/sources";
</script>

<ImportWizard descriptor={IMPORT_SOURCES.storygraph}>
  {#snippet intro()}
    <a
      href="https://app.thestorygraph.com/user-export"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">Exporte ta bibliothèque depuis StoryGraph ↗</a>
    (Manage Account → Export StoryGraph Library) puis dépose le fichier
    <code class="text-fg">.csv</code> ici. On associe chaque livre au catalogue Google
    Books ; tu choisis ensuite quoi importer.
  {/snippet}
</ImportWizard>
