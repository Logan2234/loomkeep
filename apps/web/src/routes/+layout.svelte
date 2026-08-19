<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { m } from "$lib/paraglide/messages";
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
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <title>{m.common_loomkeep()}</title>
</svelte:head>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>

<Toast />
