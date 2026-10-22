<script lang="ts">
  import * as env from "$app/env/public";
  import Banner from "#lib/components/Banner.svelte";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import {
    isNativeBrowserAvailable,
    openInAppBrowser,
  } from "#lib/native/browser.js";
  import { m } from "#lib/paraglide/messages.js";

  // Built client-side rather than bouncing through an API redirect endpoint:
  // a same-origin server redirect (GET /api/simkl/connect -> 302) was
  // silently swallowed by the browser on this same-origin navigation (seen
  // as a 200 with a Location header, no actual redirect) — going straight to
  // simkl.com from a plain <a href> sidesteps whatever intercepted that hop.
  const clientId = env.PUBLIC_SIMKL_CLIENT_ID ?? "";
  const redirectUri = `${window.location.origin}/app/settings/import/simkl/callback`;
  const authorizeUrl = `https://simkl.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  // In the Android app, Simkl opens over the app so its redirect comes back
  // into it (MOB-09) rather than into Chrome, without the app's session.
  function connect(event: MouseEvent) {
    if (!isNativeBrowserAvailable()) return;
    event.preventDefault();
    void openInAppBrowser(authorizeUrl);
  }
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    title={m.settings_import_simkl_title()}
    subtitle={m.settings_import_simkl_description()}
    back="/app/settings/import" />

  {#if !clientId}
    <Banner variant="error">
      {m.settings_import_simkl_not_configured()}
    </Banner>
  {:else}
    <a href={authorizeUrl} class="btn btn-primary" onclick={connect}>
      {m.settings_import_simkl_button()}
    </a>
  {/if}
</div>
