<script lang="ts">
  import { page } from "$app/state";
  import { auth } from "$lib/auth.svelte";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { theme } from "$lib/theme.svelte";
  import type { IconName } from "$lib/types/icon-name";
  import {
    CHANGELOG_URL,
    FEEDBACK_URL,
    GITHUB_REPO_URL,
  } from "../lib/constants/external-links";

  // Resolved per request (this page is server-rendered, not prerendered) so
  // the same code emits correct absolute URLs on loomkeep.app, on a
  // self-hoster's own domain and on localhost. See +page.ts.
  const canonical = $derived(`${page.url.origin}/`);

  // The six libraries, in the fixed domain order of the stats palette (see
  // app.css) so the colours read the same here as inside the app. Planned
  // domains have no hue of their own yet — they render dimmed instead.
  interface Library {
    label: string;
    icon: IconName;
    color?: string;
    soon?: boolean;
  }

  const LIBRARIES: Library[] = [
    { label: m.nav_media(), icon: "tv", color: "var(--stat-media)" },
    { label: m.nav_games(), icon: "gamepad", color: "var(--stat-games)" },
    { label: m.nav_books(), icon: "book", color: "var(--stat-books)" },
    { label: m.nav_music(), icon: "music", color: "var(--stat-music)" },
    { label: m.nav_podcasts(), icon: "podcast", soon: true },
    { label: m.nav_boardgames(), icon: "boardgame", soon: true },
  ];

  const FEATURES = [
    {
      icon: "calendar",
      title: m.landing_feature_calendar_title(),
      body: m.landing_feature_calendar_body(),
    },
    {
      icon: "refresh",
      title: m.landing_feature_rewatch_title(),
      body: m.landing_feature_rewatch_body(),
    },
    {
      icon: "download",
      title: m.landing_feature_import_title(),
      body: m.landing_feature_import_body(),
    },
    {
      icon: "users",
      title: m.landing_feature_social_title(),
      body: m.landing_feature_social_body(),
    },
    {
      icon: "stats",
      title: m.landing_feature_stats_title(),
      body: m.landing_feature_stats_body(),
    },
    {
      icon: "shield",
      title: m.landing_feature_ownership_title(),
      body: m.landing_feature_ownership_body(),
    },
  ] as const;
</script>

<svelte:head>
  <title>Loomkeep — {m.landing_meta_tagline()}</title>
  <meta name="description" content={m.landing_meta_description()} />
  <link rel="canonical" href={canonical} />

  <!-- Absolute URLs: link-preview scrapers (Slack, Discord, WhatsApp…) don't
       resolve relative ones, unlike browsers. -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Loomkeep" />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content="Loomkeep — {m.landing_meta_tagline()}" />
  <meta property="og:description" content={m.landing_meta_description()} />
  <meta property="og:image" content="{page.url.origin}/pwa-512.png" />
  <meta property="og:locale" content="fr_FR" />
  <meta name="twitter:card" content="summary" />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <header
    class="border-border bg-bg/85 sticky top-0 z-10 border-b backdrop-blur">
    <div
      class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
      <a href="/" class="font-display text-xl font-extrabold tracking-tight">
        LOOM<span class="text-accent">KEEP</span>
      </a>

      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={() => theme.toggle()}
          aria-label={m.landing_theme_toggle()}
          title={m.landing_theme_toggle()}
          class="hover:bg-surface-2 text-dim hover:text-fg grid h-9 w-9 place-items-center rounded-lg transition-colors">
          <Icon name={theme.mode === "dark" ? "sun" : "moon"} class="h-4 w-4" />
        </button>

        <!-- Rendered only once bootstrap resolved: before that we don't know
             whether to offer "sign in" or "open the app", and flipping the
             primary CTA after paint is worse than showing it a beat late. -->
        {#if bootstrap.ready}
          {#if auth.isLoggedIn}
            <a href="/app" class="btn btn-primary">{m.landing_open_app()}</a>
          {:else}
            <a href="/login" class="btn btn-ghost">{m.landing_login()}</a>
            {#if appConfig.registrationEnabled}
              <a href="/register" class="btn btn-primary hidden sm:inline-flex">
                {m.landing_register()}
              </a>
            {/if}
          {/if}
        {/if}
      </div>
    </div>
  </header>

  <main class="flex-1">
    <!-- Hero — letterbox hairlines above and below, timecode kicker. -->
    <section class="mx-auto max-w-5xl px-5 py-14 md:py-24">
      <div
        class="grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
        <div>
          <p class="timecode mb-5 text-xs tracking-[0.18em] uppercase">
            {m.landing_hero_kicker()}
          </p>
          <h1
            class="font-display text-4xl leading-[1.05] font-extrabold tracking-tight md:text-6xl">
            {m.landing_hero_title_lead()}<br class="hidden sm:block" />
            <span class="text-accent">{m.landing_hero_title_accent()}</span>
          </h1>
          <p class="text-dim mt-6 max-w-xl text-base md:text-lg">
            {m.landing_hero_body()}
          </p>

          <div class="mt-9 flex flex-wrap items-center gap-3">
            {#if bootstrap.ready && auth.isLoggedIn}
              <a
                href="/app"
                class="btn btn-primary btn-primary-cartouche px-5 py-2.5">
                {m.landing_open_app()}
              </a>
            {:else}
              {#if appConfig.registrationEnabled}
                <a
                  href="/register"
                  class="btn btn-primary btn-primary-cartouche px-5 py-2.5">
                  {m.landing_hero_cta_primary()}
                </a>
              {/if}
              <a href="/login" class="btn btn-ghost px-5 py-2.5">
                {m.landing_login()}
              </a>
            {/if}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost px-5 py-2.5">
              {m.landing_hero_cta_selfhost()}
            </a>
          </div>

          <p class="text-dim mt-5 text-sm">{m.landing_hero_note()}</p>
        </div>

        <!-- Decorative "programme" panel: poster placeholders and timecodes,
             the two signature devices of the Séance identity. Deliberately
             abstract rather than a screenshot — no invented catalogue data. -->
        <div
          aria-hidden="true"
          class="card mx-auto hidden w-72 shrink-0 p-5 md:block">
          <p class="timecode mb-4 text-[0.65rem] tracking-[0.16em] uppercase">
            {m.landing_panel_label()}
          </p>
          <ul class="space-y-3">
            {#each [{ w: "72%", tc: "S02E07" }, { w: "58%", tc: "2:46:00" }, { w: "80%", tc: "12 / 24" }, { w: "45%", tc: "1994" }] as row (row.tc)}
              <li class="flex items-center gap-3">
                <span class="skeleton h-11 w-8 shrink-0 rounded"></span>
                <span class="min-w-0 flex-1">
                  <span
                    class="skeleton block h-2.5 rounded"
                    style="width: {row.w}"></span>
                  <span class="timecode mt-1.5 block text-[0.7rem]"
                    >{row.tc}</span>
                </span>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </section>

    <!-- Libraries -->
    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          {m.landing_libraries_title()}
        </h2>
        <p class="text-dim mt-3 max-w-2xl">{m.landing_libraries_body()}</p>

        <ul class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {#each LIBRARIES as lib (lib.label)}
            <li
              class="card flex flex-col items-start gap-2 p-4"
              class:opacity-60={lib.soon}>
              <span
                class="grid h-9 w-9 place-items-center rounded-lg"
                style={lib.soon
                  ? undefined
                  : `color: ${lib.color}; background: color-mix(in srgb, ${lib.color} 14%, transparent)`}>
                <Icon name={lib.icon} class="h-5 w-5" />
              </span>
              <span class="text-sm font-semibold">{lib.label}</span>
              {#if lib.soon}
                <span
                  class="timecode text-[0.65rem] tracking-[0.12em] uppercase"
                  >{m.landing_libraries_soon()}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <!-- Features -->
    <section class="border-border bg-surface/40 border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          {m.landing_features_title()}
        </h2>

        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each FEATURES as feature (feature.title)}
            <article class="card p-5">
              <span
                class="text-accent bg-accent/12 mb-4 grid h-10 w-10 place-items-center rounded-lg">
                <Icon name={feature.icon} class="h-5 w-5" />
              </span>
              <h3 class="font-display mb-2 text-base font-bold">
                {feature.title}
              </h3>
              <p class="text-dim text-sm">{feature.body}</p>
            </article>
          {/each}
        </div>
      </div>
    </section>

    <!-- Hosted instance vs self-hosting -->
    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          {m.landing_hosting_title()}
        </h2>

        <div class="mt-8 grid gap-4 md:grid-cols-2">
          <article class="card flex flex-col p-6">
            <p class="timecode mb-3 text-[0.65rem] tracking-[0.16em] uppercase">
              {m.landing_hosting_hosted_label()}
            </p>
            <h3 class="font-display mb-2 text-lg font-bold">
              {m.landing_hosting_hosted_title()}
            </h3>
            <p class="text-dim mb-6 flex-1 text-sm">
              {m.landing_hosting_hosted_body()}
            </p>
            {#if bootstrap.ready && auth.isLoggedIn}
              <a href="/app" class="btn btn-primary self-start"
                >{m.landing_open_app()}</a>
            {:else if appConfig.registrationEnabled}
              <a href="/register" class="btn btn-primary self-start"
                >{m.landing_hero_cta_primary()}</a>
            {:else}
              <a href="/login" class="btn btn-ghost self-start"
                >{m.landing_login()}</a>
            {/if}
          </article>

          <article class="card flex flex-col p-6">
            <p class="timecode mb-3 text-[0.65rem] tracking-[0.16em] uppercase">
              {m.landing_hosting_selfhost_label()}
            </p>
            <h3 class="font-display mb-2 text-lg font-bold">
              {m.landing_hosting_selfhost_title()}
            </h3>
            <p class="text-dim mb-6 flex-1 text-sm">
              {m.landing_hosting_selfhost_body()}
            </p>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost self-start">
              {m.landing_hosting_selfhost_cta()}
            </a>
          </article>
        </div>
      </div>
    </section>
  </main>

  <footer class="border-border border-t">
    <div
      class="text-dim mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-5 pt-6 text-xs">
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-fg transition-colors hover:underline">GitHub</a>
      <a
        href={FEEDBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-fg transition-colors hover:underline"
        >{m.landing_footer_feedback()}</a>
      <a
        href={CHANGELOG_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-fg transition-colors hover:underline"
        >{m.landing_footer_changelog()}</a>
    </div>
    <LegalLinks />
  </footer>
</div>
