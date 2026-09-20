<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="letterboxd">
  {#snippet intro()}
    {m.settings_import_letterboxd_intro()}
    <a
      href="https://letterboxd.com/settings/data/"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_letterboxd_export_link()}</a
    >. {m.settings_import_letterboxd_hint()}
  {/snippet}
</ImportWizard>
