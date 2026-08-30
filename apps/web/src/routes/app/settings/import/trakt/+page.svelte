<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="trakt">
  {#snippet intro()}
    {m.settings_import_trakt_intro()}
    <code class="bg-bg rounded px-1.5 py-0.5 font-mono text-xs">.zip</code>
    de ton export Trakt (<a
      href="https://trakt.tv/settings/data"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_trakt_settings_link()}</a
    >, {m.settings_import_trakt_vip_note()}). {m.settings_import_trakt_hint()}
  {/snippet}
</ImportWizard>
