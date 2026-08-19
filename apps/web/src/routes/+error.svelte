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
  <title>{isNotFound ? "Page introuvable" : "Erreur"} · Loomkeep</title>
</svelte:head>

<div
  class="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
  <!-- Torn film strip: two frames snapped apart mid-reel. -->
  <svg
    viewBox="0 0 320 140"
    class="mb-6 h-auto w-56 sm:w-64"
    xmlns="http://www.w3.org/2000/svg"
    role="presentation">
    <g style="fill: var(--surface); stroke: var(--border)" stroke-width="2">
      <rect x="10" y="30" width="130" height="80" rx="6" />
      <rect x="180" y="30" width="130" height="80" rx="6" />
    </g>
    <g style="fill: var(--accent)">
      <circle cx="25" cy="45" r="4" />
      <circle cx="25" cy="65" r="4" />
      <circle cx="25" cy="85" r="4" />
      <circle cx="25" cy="95" r="4" />
      <circle cx="125" cy="45" r="4" />
      <circle cx="125" cy="65" r="4" />
      <circle cx="125" cy="85" r="4" />
      <circle cx="125" cy="95" r="4" />
      <circle cx="195" cy="45" r="4" />
      <circle cx="195" cy="65" r="4" />
      <circle cx="195" cy="85" r="4" />
      <circle cx="195" cy="95" r="4" />
      <circle cx="295" cy="45" r="4" />
      <circle cx="295" cy="65" r="4" />
      <circle cx="295" cy="85" r="4" />
      <circle cx="295" cy="95" r="4" />
    </g>
    <path
      d="M140 30 L150 40 L142 55 L155 65 L145 78 L158 90 L148 110 L180 110 L172 95 L182 82 L170 70 L180 58 L168 45 L180 30 Z"
      style="fill: var(--bg); stroke: var(--accent)"
      stroke-width="2"
      stroke-linejoin="round" />
  </svg>

  {#if isNotFound}
    <p class="timecode mb-3 text-xs tracking-[0.2em] uppercase">
      {m.error_404_eyebrow()}
    </p>
    <h1 class="font-display text-6xl font-bold sm:text-7xl">404</h1>
    <p class="mt-3 text-lg font-semibold">{m.error_404_title()}</p>
    <p class="text-dim mt-2 max-w-sm text-sm">{m.error_404_body()}</p>

    <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
      <a href={homeHref} class="btn btn-primary">{m.error_404_cta_home()}</a>
      {#if auth.isLoggedIn}
        <a href="/app/search" class="btn btn-ghost"
          >{m.error_404_cta_search()}</a>
      {/if}
    </div>
  {:else}
    <p class="timecode mb-3 text-xs tracking-[0.2em] uppercase">
      {m.error_generic_eyebrow({ status: String(status) })}
    </p>
    <h1 class="font-display text-6xl font-bold sm:text-7xl">{status}</h1>
    <p class="mt-3 text-lg font-semibold">{m.error_generic_title()}</p>
    <p class="text-dim mt-2 max-w-sm text-sm">{m.error_generic_body()}</p>

    <div class="mt-8">
      <a href={homeHref} class="btn btn-primary"
        >{m.error_generic_cta_home()}</a>
    </div>
  {/if}
</div>
