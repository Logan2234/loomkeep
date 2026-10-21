<script lang="ts">
  import ImportWizard from "#lib/components/ImportWizard.svelte";
  import { m } from "#lib/paraglide/messages.js";
</script>

<ImportWizard source="tvtime">
  {#snippet intro()}
    {m.settings_import_tvtime_hint()}
  {/snippet}
</ImportWizard>
