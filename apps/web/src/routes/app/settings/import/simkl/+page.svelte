<script lang="ts">
  import { env } from "$env/dynamic/public";
  import Banner from "$lib/components/Banner.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";

  // Built client-side rather than bouncing through an API redirect endpoint:
  // a same-origin server redirect (GET /api/simkl/connect -> 302) was
  // silently swallowed by the browser on this same-origin navigation (seen
  // as a 200 with a Location header, no actual redirect) — going straight to
  // simkl.com from a plain <a href> sidesteps whatever intercepted that hop.
  const clientId = env.PUBLIC_SIMKL_CLIENT_ID ?? "";
  const redirectUri = `${window.location.origin}/app/settings/import/simkl/callback`;
  const authorizeUrl = `https://simkl.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <div class="mb-6 flex items-center gap-3">
    <a
      href="/app/settings/import"
      class="text-dim hover:text-fg"
      aria-label={m.common_back()}>
      <Icon name="chevron-left" class="h-5 w-5" />
    </a>
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      {m.settings_import_simkl_title()}
    </h1>
  </div>

  {#if !clientId}
    <Banner variant="error">
      {m.settings_import_simkl_not_configured()}
    </Banner>
  {:else}
    <p class="text-dim mb-6 max-w-xl text-sm">
      {m.settings_import_simkl_description()}
    </p>

    <a href={authorizeUrl} class="btn btn-primary">
      {m.settings_import_simkl_button()}
    </a>
  {/if}
</div>
