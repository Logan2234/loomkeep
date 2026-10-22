<script lang="ts">
  import { type LayoutProps } from "./$types";

  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { scanNotifications } from "#lib/api/client.js";
  import { auth } from "#lib/auth.svelte.js";
  import { trackBackHistory } from "#lib/back-nav.svelte.js";
  import { bootstrap } from "#lib/bootstrap.svelte.js";
  import BootSplash from "#lib/components/BootSplash.svelte";
  import ChatLauncher from "#lib/components/chat/ChatLauncher.svelte";
  import ChatRealtime from "#lib/components/chat/ChatRealtime.svelte";
  import ChatSheet from "#lib/components/chat/ChatSheet.svelte";
  import DeletionScheduledBanner from "#lib/components/DeletionScheduledBanner.svelte";
  import { chat } from "#lib/chat/chat.svelte.js";
  import { appConfig } from "#lib/config.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import NotificationBell from "#lib/components/NotificationBell.svelte";
  import OnboardingWidget from "#lib/components/onboarding/OnboardingWidget.svelte";
  import OnboardingWizard from "#lib/components/onboarding/OnboardingWizard.svelte";
  import RealtimeConnection from "#lib/components/RealtimeConnection.svelte";
  import ReauthModal from "#lib/components/ReauthModal.svelte";
  import DesktopSidebar from "#lib/components/sidebars/DesktopSidebar.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import MobileLayout from "#lib/components/sidebars/MobileLayout.svelte";
  import { useEeLock } from "#lib/ee/license.svelte.js";
  import ProgrammeBoardDesktop from "#lib/ee/nav/ProgrammeBoardDesktop.svelte";
  import ProjectorDockDesktop from "#lib/ee/nav/ProjectorDockDesktop.svelte";
  import TermsReacceptance from "#lib/components/TermsReacceptance.svelte";
  import WidgetIdentify from "#lib/components/WidgetIdentify.svelte";
  import { navStyle } from "#lib/nav-style.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { reauth } from "#lib/reauth.svelte.js";
  import { LEGAL_VERSION } from "@loomkeep/shared";
  import UnlockBubble from "./components/UnlockBubble.svelte";

  const needsTermsReacceptance = $derived(
    !!auth.user && auth.user.acceptedTermsVersion !== LEGAL_VERSION,
  );

  // "Dock" and "Programme" are premium nav skins (see nav-style.svelte.ts) —
  // fall back to the free "Marquee" rail whenever the flag is on and the
  // account isn't premium, regardless of what's still saved in
  // localStorage (e.g. a lapsed subscription).
  const eeLock = useEeLock();
  const navStyleLocked = $derived(eeLock.locked);
  const effectiveNavStyle = $derived(
    navStyleLocked ? "marquee" : navStyle.choice,
  );

  let { children }: LayoutProps = $props();

  trackBackHistory();

  // Every route under /app requires a session: belonging to this layout *is*
  // the gate, so there's no route allowlist to keep in sync when a screen is
  // added. Public surfaces live outside /app (landing, (auth)/, legal/).
  $effect(() => {
    // `apiUnreachable` means the session is unknown, not absent — bouncing to
    // /login there would log people out on a dropped connection. The
    // reconnect screen below takes over instead.
    if (bootstrap.ready && !bootstrap.apiUnreachable && !auth.isLoggedIn)
      void goto(
        `/login?redirectTo=${encodeURIComponent(page.url.pathname + page.url.search)}`,
        // The gated page never showed: it leaves nothing to go back to.
        { replace: true },
      );
  });

  // Once logged in, trigger this user's release scan (push/email digest
  // only — release rows never reach the in-app bell) instead of waiting for
  // the hourly cron.
  $effect(() => {
    if (bootstrap.ready && auth.isLoggedIn) void scanNotifications();
  });
</script>

{#if !bootstrap.ready}
  <BootSplash />
{:else if bootstrap.apiUnreachable && !auth.isLoggedIn}
  <div
    class="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
    <Icon name="warning" class="text-dim h-10 w-10" />
    <div>
      <h1 class="font-display text-xl font-extrabold tracking-tight">
        {m.app_offline_title()}
      </h1>
      <p class="text-dim mt-1 text-sm">{m.apierr_network_offline()}</p>
    </div>
    <button
      type="button"
      class="btn btn-primary"
      onclick={() => bootstrap.retry()}>
      {m.common_retry()}
    </button>
  </div>
{:else if auth.isLoggedIn}
  <RealtimeConnection />
  <NotificationBell />
  <!-- Mounting triggers level-up bubbles; achievement unlocks can also arrive live. -->
  <UnlockBubble />
  <WidgetIdentify />
  <OnboardingWidget />
  {#if appConfig.chatEnabled}
    <ChatRealtime />
    {#if !layout.compact}
      <ChatLauncher />
    {:else if chat.open}
      <ChatSheet />
    {/if}
  {/if}

  <!-- Exactly one shell is mounted: rendering both and hiding one in CSS
       duplicated every `id` on the page, which broke `#section` anchors and
       `aria-describedby`. See layout.svelte.ts for why the choice isn't a
       plain `md:` width breakpoint. -->
  {#snippet content()}
    <DeletionScheduledBanner />
    {@render children()}
  {/snippet}
  {#if layout.compact}
    <MobileLayout navStyle={effectiveNavStyle}>
      {@render content()}
    </MobileLayout>
  {:else if effectiveNavStyle === "dock"}
    <ProjectorDockDesktop>
      {@render content()}
    </ProjectorDockDesktop>
  {:else if effectiveNavStyle === "board"}
    <ProgrammeBoardDesktop>
      {@render content()}
    </ProgrammeBoardDesktop>
  {:else}
    <DesktopSidebar>
      {@render content()}
    </DesktopSidebar>
  {/if}

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

  {#if reauth.reason}
    <ReauthModal reason={reauth.reason} />
  {/if}
{/if}
