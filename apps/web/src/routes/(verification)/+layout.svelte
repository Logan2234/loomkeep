<script lang="ts">
  import { type LayoutProps } from "./$types";

  import { bootstrap } from "#lib/bootstrap.svelte.js";
  import BootSplash from "#lib/components/BootSplash.svelte";

  let { children }: LayoutProps = $props();
</script>

<!-- Email-verification steps: reachable signed in *or* out, so they get no
     guard — only the bootstrap gate, because both pages branch on
     `auth.user` as soon as they mount. -->
{#if bootstrap.ready}
  {@render children()}
{:else}
  <BootSplash />
{/if}
