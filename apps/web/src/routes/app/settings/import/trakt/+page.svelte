<script lang="ts">
  import ImportWizard from "$lib/components/ImportWizard.svelte";
</script>

<ImportWizard source="trakt">
  {#snippet intro()}
    Dépose l'archive <code class="bg-bg rounded px-1.5 py-0.5 font-mono text-xs"
      >.zip</code>
    de ton export Trakt (<a
      href="https://trakt.tv/settings/data"
      target="_blank"
      rel="noopener noreferrer"
      class="link-accent">Réglages → Data → Export ↗</a
    >, gratuit — contrairement à la création d'une app API Trakt, désormais
    réservée aux comptes VIP). On l'analyse pour te laisser trier collection par
    collection avant d'écrire quoi que ce soit.
  {/snippet}
</ImportWizard>
