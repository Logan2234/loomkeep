<script lang="ts">
  import {
    ADMIN_PAGE_WIDTH,
    adminPageLayout,
  } from "$lib/constants/admin-layout";
  import type { Snippet } from "svelte";

  let { pathname, children }: { pathname: string; children: Snippet } =
    $props();
  const layout = $derived(adminPageLayout(pathname));
</script>

<main
  class="mx-auto w-full px-5 py-6 md:px-8 md:py-10 {ADMIN_PAGE_WIDTH[layout]}"
  data-admin-layout={layout}>
  {@render children()}
</main>
