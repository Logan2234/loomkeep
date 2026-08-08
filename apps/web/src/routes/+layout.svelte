<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import { adminReports } from "$lib/admin-reports.svelte";
  import { initAuth, initConfig } from "$lib/api/client";
  import favicon from "$lib/assets/favicon.svg";
  import { auth } from "$lib/auth.svelte";
  import DesktopSidebar from "$lib/components/sidebars/DesktopSidebar.svelte";
  import MobileLayout from "$lib/components/sidebars/MobileLayout.svelte";
  import NotificationBell from "$lib/components/NotificationBell.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { notifications } from "$lib/notifications.svelte";
  import { queryClient } from "$lib/queryClient";
  import { theme } from "$lib/theme.svelte";
  import "@fontsource-variable/bricolage-grotesque/wght.css";
  import "@fontsource-variable/hanken-grotesk/wght.css";
  import "@fontsource/space-mono/400.css";
  import "@fontsource/space-mono/700.css";
  import "../app.css";

  let { children } = $props();
  let ready = $state(false);

  const PUBLIC_ROUTES = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];

  $effect(() => {
    // Load auth and the public runtime config (social flag) in parallel before
    // rendering, so social surfaces don't flash in/out once they exist.
    Promise.all([initAuth(), initConfig()]).finally(() => {
      ready = true;
    });
  });

  $effect(() => {
    theme.init();
  });

  // Once logged in, trigger this user's episode scan (push/email only — see
  // NotificationService) instead of waiting for the hourly cron, then load
  // the bell feed (follow/comment activity).
  $effect(() => {
    if (ready && auth.isLoggedIn) void notifications.refresh(true);
    if (ready && auth.isAdmin) void adminReports.refresh();
  });

  // Poll unread notifications + the admin reports badge while the tab is
  // active, so both update without a full page reload — same idiom as
  // CommentThread's refetchInterval, just for these two rune stores instead
  // of a TanStack Query (there's no per-page "enabled" scope for a global
  // nav badge, so this lives at the root layout).
  $effect(() => {
    if (!ready || !auth.isLoggedIn) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void notifications.refresh();
      if (auth.isAdmin) void adminReports.refresh();
    }, 20_000);
    return () => clearInterval(interval);
  });

  // Redirect to /login as soon as we know the user is not authenticated.
  $effect(() => {
    if (
      ready &&
      !auth.isLoggedIn &&
      !PUBLIC_ROUTES.includes(page.url.pathname)
    ) {
      void goto("/login");
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <!-- iOS home-screen icon (ignores the SVG favicon / manifest); required for
       installing the PWA, which is itself a prerequisite for Web Push on iOS. -->
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <title>Loomkeep</title>
</svelte:head>

<QueryClientProvider client={queryClient}>
  {#if ready && auth.isLoggedIn}
    <NotificationBell />

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
  {:else if ready}
    {@render children()}
  {/if}
</QueryClientProvider>

<Toast />
