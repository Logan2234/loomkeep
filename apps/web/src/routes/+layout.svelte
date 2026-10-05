<script lang="ts">
  import { page } from "$app/state";
  import * as env from "$app/env/public";
  import { bootstrap } from "#lib/bootstrap.svelte.js";
  import NewsBanner from "#lib/components/NewsBanner.svelte";
  import Toast from "#lib/components/Toast.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { navStyle } from "#lib/navStyle.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import { regionalLocale } from "@loomkeep/shared";
  import { queryClient } from "#lib/queryClient.js";
  import { accessibility } from "#lib/accessibility.svelte.js";
  import { theme } from "#lib/theme.svelte.js";
  import "@fontsource-variable/bricolage-grotesque/wght.css";
  import "@fontsource-variable/hanken-grotesk/wght.css";
  import "@fontsource/space-mono/400.css";
  import "@fontsource/space-mono/700.css";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import "../app.css";

  let { children } = $props();

  $effect(() => {
    bootstrap.start();
  });

  $effect(() => {
    theme.init();
  });

  $effect(() => {
    accessibility.init();
  });

  $effect(() => {
    navStyle.init();
  });

  $effect(() => {
    layout.init();
  });
</script>

<svelte:head>
  <title>{m.common_loomkeep()}</title>

  <meta name="description" content={m.landing_meta_description()} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={m.common_loomkeep()} />
  <meta property="og:url" content={page.url.href} />
  <meta
    property="og:title"
    content="{m.common_loomkeep()} — {m.landing_meta_tagline()}" />
  <meta property="og:description" content={m.landing_meta_description()} />
  <meta property="og:image" content="{page.url.origin}/og.png" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="640" />
  <meta property="og:image:alt" content={m.landing_meta_description()} />
  <meta
    property="og:locale"
    content={regionalLocale(getLocale()).replace("-", "_")} />
  <meta name="twitter:card" content="summary_large_image" />

  <link rel="preconnect" href={env.PUBLIC_API_URL} />
  <link rel="canonical" href={page.url.href} />
</svelte:head>

<NewsBanner />

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>

<Toast />
