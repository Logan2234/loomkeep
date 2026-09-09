<script lang="ts">
  import { bootstrap } from "$lib/bootstrap.svelte";
  import BootSplash from "$lib/components/BootSplash.svelte";

  let { children } = $props();
</script>

<!-- Email-verification steps: reachable signed in *or* out, so they get no
     guard — only the bootstrap gate, because both pages branch on
     `auth.user` as soon as they mount. -->
{#if bootstrap.ready}
  {@render children()}
{:else}
  <BootSplash />
{/if}
