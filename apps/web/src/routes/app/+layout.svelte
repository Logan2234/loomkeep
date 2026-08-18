<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminReports } from "$lib/admin-reports.svelte";
  import { auth } from "$lib/auth.svelte";
  import { trackBackHistory } from "$lib/backNav.svelte";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import NotificationBell from "$lib/components/NotificationBell.svelte";
  import OnboardingWizard from "$lib/components/onboarding/OnboardingWizard.svelte";
  import DesktopSidebar from "$lib/components/sidebars/DesktopSidebar.svelte";
  import MobileLayout from "$lib/components/sidebars/MobileLayout.svelte";
  import WidgetIdentify from "$lib/components/WidgetIdentify.svelte";
  import { notifications } from "$lib/notifications.svelte";
  import { m } from "$lib/paraglide/messages.js";

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

  // Once logged in, trigger this user's episode scan (push/email only — see
  // NotificationService) instead of waiting for the hourly cron, then load
  // the bell feed (follow/comment activity).
  $effect(() => {
    if (bootstrap.ready && auth.isLoggedIn) void notifications.refresh(true);
    if (bootstrap.ready && auth.isAdmin) void adminReports.refresh();
  });

  // Poll unread notifications + the admin reports badge while the tab is
  // active, so both update without a full page reload — same idiom as
  // CommentThread's refetchInterval, just for these two rune stores instead
  // of a TanStack Query (there's no per-page "enabled" scope for a global
  // nav badge, so this lives at the /app layout).
  $effect(() => {
    if (!bootstrap.ready || !auth.isLoggedIn) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void notifications.refresh();
      if (auth.isAdmin) void adminReports.refresh();
    }, 20_000);
    return () => clearInterval(interval);
  });
</script>

{#if bootstrap.ready && auth.isLoggedIn}
  <NotificationBell />
  <WidgetIdentify />

  <div class="hidden md:block">
    <DesktopSidebar>
      {@render children()}
    </DesktopSidebar>
  </div>

  <div class="md:hidden">
    <MobileLayout>
      {@render children()}
    </MobileLayout>
  </div>

  {#if !auth.user?.onboardedAt}
    <Modal
      dismissable={false}
      title={m.onboarding_modal_title()}
      onclose={() => {}}
      wide
      blur
      overflowVisible>
      <OnboardingWizard />
    </Modal>
  {/if}
{/if}
