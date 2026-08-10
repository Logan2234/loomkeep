<script lang="ts">
  // Shows and identifies the Quackback feedback widget (app.html loads its
  // loader script, but never calls "init" itself) — mounted only on
  // authenticated, non-public routes (see +layout.svelte), so its own
  // mount/unmount lifecycle is what keeps the widget off login/register/
  // legal pages: shown on mount, hidden on unmount (navigating to a public
  // route, or logging out). "identify" puts it in "Verified identity only"
  // mode — the widget trusts our signed token instead of asking the visitor
  // to type in their own email. Renders nothing; a failure here (e.g.
  // QUACKBACK_WIDGET_SECRET unset) just leaves the widget anonymous rather
  // than breaking the app.
  import { browser } from "$app/environment";
  import { ApiError, getWidgetToken } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";

  $effect(() => {
    if (!browser || !auth.isLoggedIn || !window.Quackback) return;

    window.Quackback("init");
    window.Quackback("showLauncher");

    getWidgetToken()
      .then(({ ssoToken }) => window.Quackback?.("identify", { ssoToken }))
      .catch((err) => {
        console.error(
          "Quackback identify failed:",
          err instanceof ApiError ? err.message : err,
        );
      });

    return () => window.Quackback?.("hideLauncher");
  });
</script>
