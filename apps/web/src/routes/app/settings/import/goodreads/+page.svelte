<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="goodreads">
  {#snippet intro()}
    <a
      href="https://help.goodreads.com/s/article/How-do-I-import-or-export-my-books-1553870934590"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_goodreads_intro()}</a>
    {m.settings_import_goodreads_hint()}
    <code class="text-fg">.csv</code>
  {/snippet}
</ImportWizard>
