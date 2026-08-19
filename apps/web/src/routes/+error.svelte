<script lang="ts">
  import { page } from "$app/state";
  import { auth } from "$lib/auth.svelte";
  import { m } from "$lib/paraglide/messages.js";

  const status = $derived(page.status);
  const isNotFound = $derived(status === 404);
  // /app is guarded by its own layout (redirects to /login when signed out),
  // so this is safe to send everyone through — logged-out users land on
  // login instead of a dead end.
  const homeHref = $derived(auth.isLoggedIn ? "/app" : "/");
</script>

<svelte:head>
  <title
    >{isNotFound ? "Page introuvable" : "Erreur"} · {m.common_loomkeep()}</title>
</svelte:head>

<div
  class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
  <!-- Letterbox hairlines: the "Séance" signature device, framing the void
       where a page should have been. -->
  <div class="border-border absolute inset-x-0 top-0 border-t"></div>
  <div class="border-border absolute inset-x-0 bottom-0 border-b"></div>

  <div class="flex max-w-sm flex-col items-center gap-8 py-16 text-center">
    <!-- Door plaque: the amber "marquee" cartouche used for ratings
         elsewhere, supersized into a screening-room sign for a room that
         doesn't exist. -->
    <div
      class="bg-btn text-btn-fg flex flex-col items-center gap-1 rounded-2xl px-10 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
      <span
        class="font-mono text-xs font-bold tracking-[0.3em] uppercase opacity-70">
        {isNotFound
          ? m.error_404_plaque_label()
          : m.error_generic_plaque_label()}
      </span>
      <span
        class="font-mono text-6xl leading-none font-bold tabular-nums sm:text-7xl">
        {status}
      </span>
      <span
        class="font-mono text-xs font-bold tracking-[0.2em] uppercase opacity-70">
        {isNotFound
          ? m.error_404_plaque_caption()
          : m.error_generic_plaque_caption()}
      </span>
    </div>

    <div class="flex flex-col items-center gap-3">
      <h1
        class="font-display text-3xl leading-tight font-bold text-balance sm:text-4xl">
        {isNotFound ? m.error_404_title() : m.error_generic_title()}
      </h1>
      <p class="text-dim text-sm text-balance">
        {isNotFound ? m.error_404_body() : m.error_generic_body()}
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-center gap-3">
      <a href={homeHref} class="btn btn-primary">
        {isNotFound ? m.error_404_cta_home() : m.error_generic_cta_home()}
      </a>
      {#if isNotFound && auth.isLoggedIn}
        <a href="/app/search" class="btn btn-ghost"
          >{m.error_404_cta_search()}</a>
      {/if}
    </div>
  </div>
</div>
