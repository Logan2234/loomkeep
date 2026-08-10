<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
  import { IMPORT_SOURCES } from "$lib/import/sources";
</script>

<ImportWizard descriptor={IMPORT_SOURCES.tvtime}>
  {#snippet intro()}
    Dépose l’archive <code class="bg-bg rounded px-1.5 py-0.5 font-mono text-xs"
      >.zip</code>
    de ton
    <a
      href="https://gdpr.tvtime.com/gdpr/self-service"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">export GDPR TV Time ↗</a
    >. On l’analyse pour te laisser trier collection par collection avant
    d’écrire quoi que ce soit.
  {/snippet}
</ImportWizard>
