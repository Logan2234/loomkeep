<script lang="ts">
  import { onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { toIntlLocale } from "$lib/constants/language-to-locale";
  import { navStyle } from "$lib/navStyle.svelte";
  import { m } from "$lib/paraglide/messages";
  import { getLocale } from "$lib/paraglide/runtime";
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

  // Cross-fade between routes instead of the hard cut the app had. Uses the
  // browser's own View Transitions API rather than a wrapper transition: it
  // captures the outgoing page as a snapshot, so nothing has to stay mounted
  // and no layout is measured twice. Unsupported browsers navigate exactly as
  // before. The animation itself is declared in app.css, which is also where
  // prefers-reduced-motion turns it off.
  onNavigate((navigation) => {
    if (!document.startViewTransition) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
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
    content={toIntlLocale(getLocale()).replace("-", "_")} />
  <meta name="twitter:card" content="summary" />

  <link rel="preconnect" href={env.PUBLIC_API_URL} />
  <link rel="canonical" href={page.url.href} />
</svelte:head>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>

<Toast />
