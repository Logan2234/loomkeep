<script lang="ts">
  // Loads and shows the Quackback feedback widget, on an instance that set
  // PUBLIC_QUACKBACK_URL and for an account that didn't hide it — mounted only on
  // authenticated, non-public routes (see app/+layout.svelte), so its own
  // mount/unmount lifecycle is what keeps the widget off the landing page and
  // login/register/legal pages: loaded on mount, hidden on unmount
  // (navigating to a public route, or logging out). The SDK is loaded here
  // rather than unconditionally in app.html so an anonymous visitor to the
  // landing page never pulls in a third-party iframe.
  //
  // "identify" (Quackback's "Verified identity only" mode, trusting our
  // signed SSO token instead of asking the visitor to type their own email)
  // is disabled for now: calling it re-authenticates the user against
  // Quackback on every widget mount, and Quackback's own "new sign-in from a
  // new device" security email fires far too often as a result (their
  // per-team toggle for that notification doesn't cover SSO-identified
  // portal users, only team/admin accounts). Re-enable once that's fixed
  // upstream or worked around.
  import { browser } from "$app/env";
  import {
    cornerLaunchersHidden,
    feedbackBoardUrl,
    feedbackLauncherWanted,
  } from "#lib/corner-launchers.svelte.js";

  const wanted = $derived(feedbackLauncherWanted());

  // Defines window.Quackback (a queue-based stub the real SDK replaces once
  // it loads) and injects the script tag, exactly once per page load.
  function loadSdk(): void {
    if (window.Quackback) return;
    window.Quackback = (...args: unknown[]) => {
      (window.Quackback!.q ??= []).push(args);
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = `${feedbackBoardUrl}/api/widget/sdk.js`;
    document.head.appendChild(script);
  }

  $effect(() => {
    if (!browser || !wanted) return;

    loadSdk();
    window.Quackback!("init");

    return () => {
      window.Quackback?.("hideLauncher");
    };
  });

  // The launcher button (bottom-right, fixed) has no clean position on the
  // compact shell that doesn't collide with the tab bar, so it follows the
  // shell rather than a width query of its own: a phone in landscape is over
  // 800px wide, so `(min-width: 768px)` put the launcher straight on top of
  // the tab bar. The feedback board stays reachable from Settings > Help.
  // Toasts stack in the same corner, so the launcher steps aside while any
  // is showing.
  $effect(() => {
    if (!browser || !wanted) return;
    window.Quackback?.(
      cornerLaunchersHidden() ? "hideLauncher" : "showLauncher",
    );
  });
</script>
