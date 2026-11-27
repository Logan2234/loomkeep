<script lang="ts">
  import { type LayoutProps } from "./$types";

  import { goto } from "$app/navigation";
  import { bootstrap } from "#lib/shell/bootstrap.svelte.js";
  import { isDomainEnabled } from "#lib/work/domain-availability.js";
  import { Domain } from "@loomkeep/shared/enums";

  let { children }: LayoutProps = $props();

  // MEDIA-domain content living outside app/media/ — same redirect as the
  // media/books/games/music layouts, see isDomainEnabled.
  $effect(() => {
    if (bootstrap.ready && !isDomainEnabled(Domain.MEDIA)) void goto("/app");
  });
</script>

{@render children()}
