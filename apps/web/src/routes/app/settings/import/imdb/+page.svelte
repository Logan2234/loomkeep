<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="imdb">
  {#snippet intro()}
    {m.settings_import_imdb_intro()}
    <a
      href="https://www.imdb.com/exports/"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_imdb_export_link()}</a
    >. {m.settings_import_imdb_hint()}
  {/snippet}
</ImportWizard>
