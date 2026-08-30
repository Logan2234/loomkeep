<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<ImportWizard source="tvtime">
  {#snippet intro()}
    {m.settings_import_tvtime_intro()}
    <code class="bg-bg rounded px-1.5 py-0.5 font-mono text-xs">.zip</code>
    {m.settings_import_tvtime_of()}
    <a
      href="https://gdpr.tvtime.com/gdpr/self-service"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">export GDPR TV Time ↗</a
    >. {m.settings_import_tvtime_hint()}
  {/snippet}
</ImportWizard>
