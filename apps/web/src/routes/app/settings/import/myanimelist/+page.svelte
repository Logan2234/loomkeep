<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="myanimelist">
  {#snippet intro()}
    {m.settings_import_myanimelist_intro()}
    <a
      href="https://myanimelist.net/panel.php?go=export"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_myanimelist_export_link()}</a
    >. {m.settings_import_myanimelist_hint()}
  {/snippet}
</ImportWizard>
