<script lang="ts">
  import { type LayoutProps } from "./$types";

  import { goto } from "$app/navigation";
  import { bootstrap } from "#lib/bootstrap.svelte.js";
  import { isDomainEnabled } from "#lib/domain-availability.js";
  import { Domain } from "@loomkeep/shared";

  let { children }: LayoutProps = $props();

  // Covers both the user's own `enabledDomains` and a domain the instance
  // doesn't offer (see isDomainEnabled) — same redirect either way,
  // so a disabled domain's pages are unreachable, not just hidden from nav.
  $effect(() => {
    if (bootstrap.ready && !isDomainEnabled(Domain.GAMES)) void goto("/app");
  });
</script>

{@render children()}
