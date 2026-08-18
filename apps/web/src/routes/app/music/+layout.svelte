<script lang="ts">
  import { goto } from "$app/navigation";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { Domain } from "@loomkeep/shared";

  let { children } = $props();

  // Covers both the user's own `enabledDomains` and a deployment-wide
  // MAINTENANCE_MUSIC flag (see isDomainEnabled) — same redirect either way,
  // so a disabled domain's pages are unreachable, not just hidden from nav.
  $effect(() => {
    if (bootstrap.ready && !isDomainEnabled(Domain.MUSIC)) void goto("/app");
  });
</script>

{@render children()}
