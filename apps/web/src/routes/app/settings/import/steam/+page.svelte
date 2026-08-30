<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="steam">
  {#snippet intro()}
    {m.settings_import_steam_intro()}
    <strong class="text-fg">{m.settings_import_steam_public()}</strong>
    {m.settings_import_steam_during()} (<a
      href="https://steamcommunity.com/my/edit/settings"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_steam_privacy_link()}</a
    >). {m.settings_import_steam_hint()}
  {/snippet}
</ImportWizard>
