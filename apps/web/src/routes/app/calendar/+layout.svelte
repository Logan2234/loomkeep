<script lang="ts">
  import { goto } from "$app/navigation";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { Domain } from "@loomkeep/shared";

  let { children } = $props();

  // MEDIA-domain content living outside app/media/ — same redirect as the
  // media/books/games/music layouts, see isDomainEnabled.
  $effect(() => {
    if (bootstrap.ready && !isDomainEnabled(Domain.MEDIA)) void goto("/app");
  });
</script>

{@render children()}
