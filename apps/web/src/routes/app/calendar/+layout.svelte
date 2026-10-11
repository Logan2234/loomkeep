<script lang="ts">
  import { type LayoutProps } from "./$types";

  import { goto } from "$app/navigation";
  import { bootstrap } from "#lib/bootstrap.svelte.js";
  import { isDomainEnabled } from "#lib/domain-availability.js";
  import { Domain } from "@loomkeep/shared";

  let { children }: LayoutProps = $props();

  // MEDIA-domain content living outside app/media/ — same redirect as the
  // media/books/games/music layouts, see isDomainEnabled.
  $effect(() => {
    if (bootstrap.ready && !isDomainEnabled(Domain.MEDIA)) void goto("/app");
  });
</script>

{@render children()}
