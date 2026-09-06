<script lang="ts">
  import { goto } from "$app/navigation";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import { isDomainAvailable } from "$lib/domains";
  import { Domain } from "@loomkeep/shared";

  let { children } = $props();

  // A parked domain remains visible as "Bientôt" in navigation, but its old
  // routes must still be unreachable when opened from history or a saved URL.
  $effect(() => {
    if (bootstrap.ready && !isDomainAvailable(Domain.MUSIC)) void goto("/app");
  });
</script>

{#if bootstrap.ready && isDomainAvailable(Domain.MUSIC)}
  {@render children()}
{/if}
