<script lang="ts">
  import { type LayoutProps } from "./$types";

  import { page } from "$app/state";
  import * as env from "$app/env/public";
  import { bootstrap } from "#lib/bootstrap.svelte.js";
  import NewsBanner from "#lib/components/NewsBanner.svelte";
  import Toast from "#lib/components/Toast.svelte";
  import { layout } from "#lib/layout.svelte.js";
  import { navStyle } from "#lib/nav-style.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import { regionalLocale } from "@loomkeep/shared";
  import { queryClient } from "#lib/query-client.js";
  import { accessibility } from "#lib/accessibility.svelte.js";
  import { theme } from "#lib/theme.svelte.js";
  import {
    isNativeApp,
    startAppShell,
    syncSystemBars,
  } from "#lib/native/app-shell.js";
  import bricolageLatin from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url";
  import hankenLatin from "@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2?url";
  import "@fontsource-variable/bricolage-grotesque/wght.css";
  import "@fontsource-variable/hanken-grotesk/wght.css";
  import "@fontsource/space-mono/400.css";
  import "@fontsource/space-mono/700.css";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import "../app.css";

  let { children }: LayoutProps = $props();

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

  $effect(() => (isNativeApp() ? startAppShell() : undefined));

  $effect(() => {
    if (isNativeApp()) void syncSystemBars(theme.mode);
  });
</script>

<svelte:head>
  <title>{m.common_loomkeep()}</title>

  {#if env.PUBLIC_SEARCH_INDEXING !== "true"}
    <!-- Self-hosted instances stay out of search results unless their admin
         opts in; see robots.txt/+server.ts. -->
    <meta name="robots" content="noindex" />
  {/if}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={m.common_loomkeep()} />
  <!-- Without the query string: a campaign link (?utm_source=…) must not
       declare itself canonical and compete with the page. -->
  <meta property="og:url" content={page.url.origin + page.url.pathname} />
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

  <!-- Without these the browser only finds the fonts once the stylesheet is
       parsed, which delays the landing title (its largest element). Latin
       subsets only: the others load on demand, by unicode-range. Same URLs
       as the stylesheet's, since Vite emits each file once. -->
  {#each [bricolageLatin, hankenLatin] as font (font)}
    <link
      rel="preload"
      href={font}
      as="font"
      type="font/woff2"
      crossorigin="anonymous" />
  {/each}
  <link rel="preconnect" href={env.PUBLIC_API_URL} />
  <link rel="canonical" href={page.url.origin + page.url.pathname} />
</svelte:head>

<div
  aria-hidden="true"
  class="bg-bg pointer-events-none fixed inset-x-0 top-0 z-45 h-[env(safe-area-inset-top)]">
</div>

<NewsBanner />

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>

<Toast />
