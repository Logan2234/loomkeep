<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="storygraph">
  {#snippet intro()}
    <a
      href="https://app.thestorygraph.com/user-export"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_storygraph_intro()}</a>
    (Manage Account → Export StoryGraph Library) {m.settings_import_storygraph_subtitle()}
    <code class="text-fg">.csv</code> ici. {m.settings_import_storygraph_hint()}
  {/snippet}
</ImportWizard>
