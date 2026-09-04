<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { scanNotifications } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { auth } from "$lib/auth.svelte";
  import { trackBackHistory } from "$lib/backNav.svelte";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import NotificationBell from "$lib/components/NotificationBell.svelte";
  import OnboardingWizard from "$lib/components/onboarding/OnboardingWizard.svelte";
  import DesktopSidebar from "$lib/components/sidebars/DesktopSidebar.svelte";
  import MobileLayout from "$lib/components/sidebars/MobileLayout.svelte";
  import ProgrammeBoardDesktop from "$lib/components/sidebars/ProgrammeBoardDesktop.svelte";
  import ProjectorDockDesktop from "$lib/components/sidebars/ProjectorDockDesktop.svelte";
  import TermsReacceptance from "$lib/components/TermsReacceptance.svelte";
  import WidgetIdentify from "$lib/components/WidgetIdentify.svelte";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import { navStyle } from "$lib/navStyle.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { LEGAL_VERSION } from "@loomkeep/shared";
  import { useQueryClient } from "@tanstack/svelte-query";
  import UnlockBubble from "./components/UnlockBubble.svelte";

  const queryClient = useQueryClient();

  const needsTermsReacceptance = $derived(
    !!auth.user && auth.user.acceptedTermsVersion !== LEGAL_VERSION,
  );

  // "Dock" and "Programme" are premium nav skins (see navStyle.svelte.ts) —
  // fall back to the free "Marquee" rail whenever the flag is on and the
  // account isn't premium, regardless of what's still saved in
  // localStorage (e.g. a lapsed subscription).
  const navStyleLocked = $derived(
    liveFlags.isEnabled("premium-features") && !auth.isPremium,
  );
  const effectiveNavStyle = $derived(
    navStyleLocked ? "marquee" : navStyle.choice,
  );

  let { children } = $props();

  trackBackHistory();

  // Every route under /app requires a session: belonging to this layout *is*
  // the gate, so there's no route allowlist to keep in sync when a screen is
  // added. Public surfaces live outside /app (landing, (auth)/, legal/).
  $effect(() => {
    if (bootstrap.ready && !auth.isLoggedIn)
      void goto(
        `/login?redirectTo=${encodeURIComponent(page.url.pathname + page.url.search)}`,
      );
  });

  // Once logged in, trigger this user's episode scan (push/email digest
  // only — NEW_EPISODE rows never reach the in-app bell, see
  // NotificationService.feed()) instead of waiting for the hourly cron.
  // The endpoint also returns the current bell feed as a bonus, which is
  // written straight into NotificationBell's query cache so it doesn't
  // need a second round trip.
  $effect(() => {
    if (bootstrap.ready && auth.isLoggedIn) {
      void scanNotifications().then((feed) =>
        queryClient.setQueryData(keys.notifications.feed(), feed),
      );
    }
  });
</script>

{#if bootstrap.ready && auth.isLoggedIn}
  <NotificationBell />
  <!-- Mounting *is* the trigger for [G6]'s unlock sequence: entering the app
       is the only moment a bubble plays. -->
  <UnlockBubble />
  <WidgetIdentify />

  <div class="hidden md:block">
    {#if effectiveNavStyle === "dock"}
      <ProjectorDockDesktop>
        <div class="route-content-desktop">{@render children()}</div>
      </ProjectorDockDesktop>
    {:else if effectiveNavStyle === "board"}
      <ProgrammeBoardDesktop>
        <div class="route-content-desktop">{@render children()}</div>
      </ProgrammeBoardDesktop>
    {:else}
      <DesktopSidebar>
        <div class="route-content-desktop">{@render children()}</div>
      </DesktopSidebar>
    {/if}
  </div>

  <div class="md:hidden">
    <MobileLayout navStyle={effectiveNavStyle}>
      <div class="route-content-mobile">{@render children()}</div>
    </MobileLayout>
  </div>

  {#if needsTermsReacceptance}
    <TermsReacceptance />
  {:else if !auth.user?.onboardedAt}
    <Modal
      dismissable={false}
      title={m.common_welcome()}
      onclose={() => {}}
      wide
      blur
      overflowVisible>
      <OnboardingWizard />
    </Modal>
  {/if}
{/if}
