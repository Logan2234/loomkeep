<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { IMPORT_SOURCES } from "$lib/import/sources";
</script>

<ImportWizard descriptor={IMPORT_SOURCES.goodreads}>
  {#snippet intro()}
    <a
      href="https://help.goodreads.com/s/article/How-do-I-import-or-export-my-books-1553870934590"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">Exporte ta bibliothèque depuis Goodreads ↗</a>
    (My Books → Import and export → Export Library) puis dépose le fichier
    <code class="text-fg">.csv</code> ici. On associe chaque livre au catalogue Google
    Books ; tu choisis ensuite quoi importer.
  {/snippet}
</ImportWizard>
