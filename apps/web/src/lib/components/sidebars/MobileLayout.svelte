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
      <!-- in-only: an out-transition here would keep the outgoing page's DOM
           (and its scroll-affecting height) alive alongside the incoming one,
           which is what caused the old page to flash behind the new one. -->
      <div in:fade={{ duration: reduced ? 0 : 120 }}>
        {@render children()}
      </div>
    {/key}
  </main>

  <BottomNavigation />

  <MenuSheet />
</div>
