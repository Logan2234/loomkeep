<script lang="ts">
  import { page } from "$app/state";
  import OnboardingBanner from "#lib/components/onboarding/OnboardingBanner.svelte";
  import ProgrammeBoardMobileBar from "#lib/ee/nav/ProgrammeBoardMobileBar.svelte";
  import ProjectorDockMobileBar from "#lib/ee/nav/ProjectorDockMobileBar.svelte";
  import { useOnboardingChecklist } from "#lib/gamification/onboarding-checklist.svelte.js";
  import { keyboard } from "#lib/keyboard.svelte.js";
  import type { NavStyle } from "#lib/nav-style.svelte.js";
  import type { Snippet } from "svelte";
  import BottomNavigation from "./BottomNavigation.svelte";
  import MenuSheet from "./MenuSheet.svelte";

  let {
    children,
    navStyle = "marquee",
  }: { children: Snippet; navStyle?: NavStyle } = $props();

  // Independent of OnboardingBanner's own query (same key, so TanStack serves
  // both from one cache entry — same idiom as NotificationTab querying the
  // bell's own feed key just for its badge count) — needed here only to know
  // whether <main> must reserve extra room above the nav bar for the docked
  // banner, since the banner itself renders below in a different stacking
  // position and nothing else reserves space for it.
  const checklistQuery = useOnboardingChecklist();
  const showOnboarding = $derived((checklistQuery.data?.steps.length ?? 0) > 0);

  $effect(() => keyboard.init());
</script>

<div class="min-h-svh">
  <main
    id="main"
    class="min-h-svh {showOnboarding && !keyboard.open
      ? 'pb-[calc(7.25rem+env(safe-area-inset-bottom))]'
      : 'pb-[var(--bottom-bar-space)]'}">
    {#key page.url.pathname}
      {@render children()}
    {/key}
  </main>

  <!-- Out of the way while typing in the Android app, where the keyboard
       would otherwise carry them up (see keyboard.svelte.ts); kept mounted. -->
  <div style:display={keyboard.open ? "none" : "contents"}>
    <OnboardingBanner />

    {#if navStyle === "dock"}
      <ProjectorDockMobileBar />
    {:else if navStyle === "board"}
      <ProgrammeBoardMobileBar />
    {:else}
      <BottomNavigation />
    {/if}
  </div>

  <MenuSheet />
</div>
