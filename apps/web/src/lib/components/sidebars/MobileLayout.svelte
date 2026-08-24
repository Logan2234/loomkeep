<script lang="ts">
  import { page } from "$app/state";
  import BottomNavigation from "./BottomNavigation.svelte";
  import MenuSheet from "./MenuSheet.svelte";

  let { children } = $props();
</script>

<div class="min-h-screen">
  <main
    class="
      min-h-screen
      pb-[calc(4.5rem+env(safe-area-inset-bottom))]
    ">
    {#key page.url.pathname}
      {@render children()}
    {/key}
  </main>

  <BottomNavigation />

  <MenuSheet />
</div>
