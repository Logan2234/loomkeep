<script lang="ts">
  import { page } from "$app/state";
  import type { NavStyle } from "$lib/navStyle.svelte";
  import type { Snippet } from "svelte";
  import BottomNavigation from "./BottomNavigation.svelte";
  import MenuSheet from "./MenuSheet.svelte";
  import ProgrammeBoardMobileBar from "./ProgrammeBoardMobileBar.svelte";
  import ProjectorDockMobileBar from "./ProjectorDockMobileBar.svelte";

  let {
    children,
    navStyle = "marquee",
  }: { children: Snippet; navStyle?: NavStyle } = $props();
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

  {#if navStyle === "dock"}
    <ProjectorDockMobileBar />
  {:else if navStyle === "board"}
    <ProgrammeBoardMobileBar />
  {:else}
    <BottomNavigation />
  {/if}

  <MenuSheet />
</div>
