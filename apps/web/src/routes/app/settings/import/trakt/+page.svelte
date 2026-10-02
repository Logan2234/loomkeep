<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="trakt">
  {#snippet intro()}
    <a
      href="https://trakt.tv/settings/data"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_trakt_intro()}</a>
    {m.settings_import_trakt_hint()}
  {/snippet}
</ImportWizard>
