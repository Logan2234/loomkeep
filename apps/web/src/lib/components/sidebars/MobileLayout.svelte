<script lang="ts">
  import { page } from "$app/state";
  import { prefersReducedMotion } from "$lib/motion";
  import { fade } from "svelte/transition";
  import BottomNavigation from "./BottomNavigation.svelte";
  import MenuSheet from "./MenuSheet.svelte";

  let { children } = $props();

  const reduced = prefersReducedMotion();
</script>

<div class="min-h-screen">
  <main
    class="
      min-h-screen
      pb-[calc(4.5rem+env(safe-area-inset-bottom))]
    ">
    {#key page.url.pathname}
      <div transition:fade={{ duration: reduced ? 0 : 120 }}>
        {@render children()}
      </div>
    {/key}
  </main>

  <BottomNavigation />

  <MenuSheet />
</div>
