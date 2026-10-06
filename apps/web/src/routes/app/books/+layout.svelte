<script lang="ts">
  import { goto } from "$app/navigation";
  import { bootstrap } from "#lib/bootstrap.svelte.js";
  import { isDomainEnabled } from "#lib/domains.js";
  import { Domain } from "@loomkeep/shared";

  let { children } = $props();

  // Covers both the user's own `enabledDomains` and a deployment-wide
  // MAINTENANCE_BOOKS flag (see isDomainEnabled) — same redirect either way,
  // so a disabled domain's pages are unreachable, not just hidden from nav.
  $effect(() => {
    if (bootstrap.ready && !isDomainEnabled(Domain.BOOKS)) void goto("/app");
  });
</script>

{@render children()}
