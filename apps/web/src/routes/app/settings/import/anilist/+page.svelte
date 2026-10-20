<script lang="ts">
  import ImportWizard from "#lib/components/ImportWizard.svelte";
  import { m } from "#lib/paraglide/messages.js";
</script>

<ImportWizard source="anilist">
  {#snippet intro()}
    <a
      href="https://anilist.co/home"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_anilist_intro()}</a
    >. {m.settings_import_anilist_hint()}
  {/snippet}
</ImportWizard>
