<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { queryClient } from "$lib/queryClient";
  import { theme } from "$lib/theme.svelte";
  import "@fontsource-variable/bricolage-grotesque/wght.css";
  import "@fontsource-variable/hanken-grotesk/wght.css";
  import "@fontsource/space-mono/400.css";
  import "@fontsource/space-mono/700.css";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import "../app.css";

  let { children } = $props();

  // Global shell only: fonts, theme, query cache, toasts. Auth lives in the
  // nested layouts (`app/`, `(auth)/`, `(verification)/`) so this one stays
  // server-renderable — the landing page and the legal pages are prerendered
  // and must not depend on browser-only state. Effects never run during
  // SSR/prerender, so both calls below are browser-only by construction.
  $effect(() => {
    bootstrap.start();
  });

  $effect(() => {
    theme.init();
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
  {@render children()}
</QueryClientProvider>

<Toast />
