<script lang="ts">
  import Banner from "$lib/components/Banner.svelte";
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="steam">
  {#snippet intro()}
    <span>{m.settings_import_steam_intro()}</span>
    <strong class="text-fg">{m.settings_import_steam_public()}</strong>
    {m.settings_import_steam_during()} (<a
      href="https://steamcommunity.com/my/edit/settings"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_steam_privacy_link()}</a
    >). {m.settings_import_steam_hint()}
    <Banner variant="warning" class="mt-4">
      <p class="font-display text-fg font-bold">
        {m.settings_import_steam_two_measures_title()}
      </p>
      <p class="text-dim mt-1 text-sm leading-relaxed">
        {m.settings_import_steam_two_measures_body()}
      </p>
      <p class="text-dim mt-2 text-sm leading-relaxed">
        {m.settings_import_steam_preserved()}
      </p>
    </Banner>
  {/snippet}
</ImportWizard>
