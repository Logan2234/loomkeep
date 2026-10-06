<script lang="ts">
  import ImportWizard from "#lib/components/ImportWizard.svelte";
  import { m } from "#lib/paraglide/messages.js";
</script>

<ImportWizard source="tvtime">
  {#snippet intro()}
    <a
      href="https://gdpr.tvtime.com/gdpr/self-service"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">{m.settings_import_tvtime_intro()}</a
    >. {m.settings_import_tvtime_hint()}
  {/snippet}
</ImportWizard>
