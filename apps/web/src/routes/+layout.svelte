<script lang="ts">
  import { page } from "$app/state";
  import { PUBLIC_API_URL } from "$env/static/public";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { toIntlLocale } from "$lib/constants/language-to-locale";
  import { navStyle } from "$lib/navStyle.svelte";
  import { m } from "$lib/paraglide/messages";
  import { baseLocale } from "$lib/paraglide/runtime";
  import { queryClient } from "$lib/queryClient";
  import { theme } from "$lib/theme.svelte";
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
    navStyle.init();
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
  <meta property="og:image" content="{page.url.origin}/pwa-512.png" />
  <meta
    property="og:locale"
    content={toIntlLocale(baseLocale).replace("-", "_")} />
  <meta name="twitter:card" content="summary" />

  <link rel="preconnect" href={PUBLIC_API_URL} />
  <link rel="canonical" href={page.url.href} />
</svelte:head>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>

<Toast />
