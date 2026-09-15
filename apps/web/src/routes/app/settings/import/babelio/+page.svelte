<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="babelio">
  {#snippet intro()}
    <a
      href="https://www.babelio.com"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_babelio_intro()}</a>
    {m.settings_import_babelio_hint()}
    <code class="text-fg">.csv</code>
  {/snippet}
</ImportWizard>
