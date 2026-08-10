<script lang="ts">
  // Loads, shows and identifies the Quackback feedback widget — mounted only
  // on authenticated, non-public routes (see app/+layout.svelte), so its own
  // mount/unmount lifecycle is what keeps the widget off the landing page and
  // login/register/legal pages: loaded on mount, hidden on unmount
  // (navigating to a public route, or logging out). The SDK is loaded here
  // rather than unconditionally in app.html so an anonymous visitor to the
  // landing page never pulls in a third-party iframe. "identify" puts it in
  // "Verified identity only" mode — the widget trusts our signed token
  // instead of asking the visitor to type in their own email. Renders
  // nothing; a failure here (e.g. QUACKBACK_WIDGET_SECRET unset) just leaves
  // the widget anonymous rather than breaking the app.
  import { browser } from "$app/environment";
  import { ApiError, getWidgetToken } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";

  // Desktop-only: the launcher button (bottom-right, fixed) has no clean
  // position on mobile that doesn't collide with the fixed bottom tab bar
  // (BottomNavigation.svelte). Same md: breakpoint as Modal.svelte/
  // DesktopSidebar's own desktop/mobile split.
  const DESKTOP_QUERY = "(min-width: 768px)";

  // Defines window.Quackback (a queue-based stub the real SDK replaces once
  // it loads) and injects the script tag, exactly once per page load.
  function loadSdk(): void {
    if (window.Quackback) return;
    window.Quackback = (...args: unknown[]) => {
      (window.Quackback!.q ??= []).push(args);
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://feedback.loomkeep.app/api/widget/sdk.js";
    document.head.appendChild(script);
  }

  $effect(() => {
    if (!browser || !auth.isLoggedIn) return;

    loadSdk();
    window.Quackback!("init");

    const mq = window.matchMedia(DESKTOP_QUERY);
    const syncLauncher = () => {
      window.Quackback?.(mq.matches ? "showLauncher" : "hideLauncher");
    };
    syncLauncher();
    mq.addEventListener("change", syncLauncher);

    getWidgetToken()
      .then(({ ssoToken }) => window.Quackback?.("identify", { ssoToken }))
      .catch((err) => {
        console.error(
          "Quackback identify failed:",
          err instanceof ApiError ? err.message : err,
        );
      });

    return () => {
      mq.removeEventListener("change", syncLauncher);
      window.Quackback?.("hideLauncher");
    };
  });
</script>
