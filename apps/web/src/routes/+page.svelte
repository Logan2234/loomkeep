<script lang="ts">
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { auth } from "$lib/auth.svelte";
  import { bootstrap } from "$lib/bootstrap.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { FEEDBACK_URL, GITHUB_REPO_URL } from "$lib/constants/external-links";
  import { m } from "$lib/paraglide/messages.js";
  import { theme } from "$lib/theme.svelte";
  import LandingFooter from "./components/LandingFooter.svelte";
  import { LANDING_LIBRARY } from "./components/landing-mock-data";

  type Salle =
    "video" | "games" | "books" | "music" | "podcasts" | "boardgames";

  const SALLES: {
    id: Salle;
    label: () => string;
    detail: () => string;
    catalog: string;
    color: string | null;
    shipped: boolean;
  }[] = [
    {
      id: "video",
      label: m.landing_salle_video_label,
      detail: m.landing_salle_video_detail,
      catalog: "TMDB · AniList",
      color: "var(--stat-media)",
      shipped: true,
    },
    {
      id: "games",
      label: m.common_Games,
      detail: m.landing_salle_games_detail,
      catalog: "IGDB",
      color: "var(--stat-games)",
      shipped: true,
    },
    {
      id: "books",
      label: m.common_Books,
      detail: m.landing_salle_books_detail,
      catalog: "Open Library",
      color: "var(--stat-books)",
      shipped: true,
    },
    {
      id: "music",
      label: m.common_albums,
      detail: m.landing_salle_music_detail,
      catalog: "MusicBrainz",
      color: "var(--stat-music)",
      shipped: true,
    },
    {
      id: "podcasts",
      label: m.common_Podcasts,
      detail: m.landing_salle_podcasts_detail,
      catalog: m.common_coming_soon(),
      color: null,
      shipped: false,
    },
    {
      id: "boardgames",
      label: m.common_Boardgames,
      detail: m.landing_salle_boardgames_detail,
      catalog: m.common_coming_soon(),
      color: null,
      shipped: false,
    },
  ];

  const RIVALS: {
    name: string;
    full: Salle[];
    partial?: { salle: Salle; what: () => string };
    price: () => string;
    note: () => string;
    selfHost?: boolean;
    closed?: boolean;
  }[] = [
    {
      name: "Trakt",
      full: ["video"],
      price: m.landing_rival_trakt_price,
      note: m.landing_rival_trakt_note,
    },
    {
      name: "Simkl",
      full: ["video"],
      price: m.landing_rival_simkl_price,
      note: m.landing_rival_simkl_note,
    },
    {
      name: "TV Time",
      full: ["video"],
      price: m.landing_rival_tvtime_price,
      note: m.landing_rival_tvtime_note,
      closed: true,
    },
    {
      name: "Letterboxd",
      full: [],
      partial: { salle: "video", what: m.landing_rival_letterboxd_what },
      price: m.landing_rival_letterboxd_price,
      note: m.landing_rival_letterboxd_note,
    },
    {
      name: "Serializd",
      full: [],
      partial: { salle: "video", what: m.landing_rival_serializd_what },
      price: m.landing_rival_serializd_price,
      note: m.landing_rival_serializd_note,
    },
    {
      name: "Backloggd",
      full: ["games"],
      price: m.landing_rival_backloggd_price,
      note: m.landing_rival_backloggd_note,
    },
    {
      name: "HowLongToBeat",
      full: [],
      partial: { salle: "games", what: m.landing_rival_hltb_what },
      price: m.landing_rival_hltb_price,
      note: m.landing_rival_hltb_note,
    },
    {
      name: "Goodreads",
      full: ["books"],
      price: m.landing_rival_goodreads_price,
      note: m.landing_rival_goodreads_note,
    },
    {
      name: "StoryGraph",
      full: ["books"],
      price: m.landing_rival_storygraph_price,
      note: m.landing_rival_storygraph_note,
    },
    {
      name: "Babelio",
      full: ["books"],
      price: m.landing_rival_babelio_price,
      note: m.landing_rival_babelio_note,
    },
    {
      name: "BookWyrm",
      full: ["books"],
      price: m.landing_rival_bookwyrm_price,
      note: m.landing_rival_bookwyrm_note,
      selfHost: true,
    },
    {
      name: "Last.fm",
      full: ["music"],
      price: m.landing_rival_lastfm_price,
      note: m.landing_rival_lastfm_note,
    },
    {
      name: "RateYourMusic",
      full: ["music"],
      price: m.landing_rival_rym_price,
      note: m.landing_rival_rym_note,
    },
    {
      name: "Discogs",
      full: [],
      partial: { salle: "music", what: m.landing_rival_discogs_what },
      price: m.landing_rival_discogs_price,
      note: m.landing_rival_discogs_note,
    },
    {
      name: "AntennaPod",
      full: ["podcasts"],
      price: m.landing_rival_antennapod_price,
      note: m.landing_rival_antennapod_note,
    },
    {
      name: "Podcast Addict",
      full: ["podcasts"],
      price: m.landing_rival_podcastaddict_price,
      note: m.landing_rival_podcastaddict_note,
    },
    {
      name: "BoardGameGeek",
      full: ["boardgames"],
      price: m.landing_rival_bgg_price,
      note: m.landing_rival_bgg_note,
    },
    {
      name: "BG Stats",
      full: ["boardgames"],
      price: m.landing_rival_bgstats_price,
      note: m.landing_rival_bgstats_note,
    },
    {
      name: "Ryot",
      full: ["video", "games", "books", "music", "podcasts"],
      price: m.landing_rival_ryot_price,
      note: m.landing_rival_ryot_note,
      selfHost: true,
    },
  ];

  const VERBS = [
    { word: m.landing_verb_watched, color: "var(--stat-media)" },
    { word: m.landing_verb_played, color: "var(--stat-games)" },
    { word: m.landing_verb_read, color: "var(--stat-books)" },
    { word: m.landing_verb_listened, color: "var(--stat-music)" },
  ];

  let picked = $state<Salle[]>(["video", "games", "books"]);
  let showDetail = $state(false);
  let verb = $state(0);
  let beamX = $state(50);
  let beamY = $state(42);
  let heroEl = $state<HTMLElement>();

  function toggle(id: Salle) {
    picked = picked.includes(id)
      ? picked.filter((s) => s !== id)
      : [...picked, id];
  }

  const eligibleRivals = RIVALS.filter((r) => !r.selfHost && !r.closed);

  const stack = $derived.by(() => {
    const remaining = new Set(picked);
    const chosen: string[] = [];
    while (remaining.size > 0) {
      let best: (typeof RIVALS)[number] | null = null;
      let bestGain = 0;
      for (const rival of eligibleRivals) {
        const gain = rival.full.filter((s) => remaining.has(s)).length;
        if (gain > bestGain) {
          best = rival;
          bestGain = gain;
        }
      }
      if (!best) break;
      chosen.push(best.name);
      for (const salle of best.full) remaining.delete(salle);
    }
    return { apps: chosen, uncovered: [...remaining] };
  });

  const pickedUnshipped = $derived(
    SALLES.filter((s) => picked.includes(s.id) && !s.shipped),
  );

  const tabsLabel = $derived(
    stack.apps.length > 1
      ? m.landing_final_tabs_count({ count: stack.apps.length })
      : m.landing_final_tabs_fallback(),
  );

  const IMPORTS_DONE: {
    name: string;
    what: () => string;
    note?: () => string;
  }[] = [
    {
      name: "TV Time",
      what: m.landing_import_done_tvtime_what,
      note: m.landing_import_done_tvtime_note,
    },
    { name: "Trakt", what: m.landing_import_done_trakt_what },
    { name: "Simkl", what: m.landing_import_done_simkl_what },
    { name: "Steam", what: m.landing_import_done_steam_what },
    { name: "Goodreads", what: m.landing_import_done_goodreads_what },
    { name: "StoryGraph", what: m.landing_import_done_storygraph_what },
  ];

  const IMPORTS_TODO: { name: string; what: () => string }[] = [
    { name: "Letterboxd", what: m.landing_import_todo_letterboxd_what },
    { name: "Serializd", what: m.landing_import_todo_serializd_what },
    { name: "IMDb", what: m.landing_import_todo_imdb_what },
    { name: "Backloggd", what: m.landing_import_todo_backloggd_what },
    { name: "Last.fm", what: m.landing_import_todo_lastfm_what },
    { name: "RateYourMusic", what: m.landing_import_todo_rym_what },
    { name: "Babelio", what: m.landing_import_todo_babelio_what },
    { name: "BoardGameGeek", what: m.landing_import_todo_bgg_what },
  ];

  $effect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) return;
    const id = setInterval(() => {
      verb = (verb + 1) % VERBS.length;
    }, 2200);
    return () => clearInterval(id);
  });

  $effect(() => {
    const hero = heroEl;
    if (!hero) return;
    const move = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      beamX = ((event.clientX - rect.left) / rect.width) * 100;
      beamY = ((event.clientY - rect.top) / rect.height) * 100;
    };
    hero.addEventListener("pointermove", move);
    return () => hero.removeEventListener("pointermove", move);
  });

  $effect(() => {
    void bootstrap.ready;
    void appConfig.registrationEnabled;
    if (!env.PUBLIC_UMAMI_WEBSITE_ID) return;
    document.querySelectorAll<HTMLAnchorElement>("a").forEach((a) => {
      if (
        a.host !== window.location.host &&
        !a.hasAttribute("data-umami-event")
      ) {
        a.setAttribute("data-umami-event", "outbound-link-click");
        a.setAttribute("data-umami-event-url", a.href);
      }
    });
  });
</script>

{#snippet primaryCta(label: string, event: string, cls: string)}
  {#if bootstrap.ready}
    {#if auth.isLoggedIn}
      <a href="/app" class={cls} data-umami-event="{event}-open-app">
        {m.landing_open_app()}
      </a>
    {:else if appConfig.registrationEnabled}
      <a href="/register" class={cls} data-umami-event={event}>{label}</a>
    {:else}
      <a href="/login" class={cls} data-umami-event="{event}-login">
        {m.common_login()}
      </a>
    {/if}
  {/if}
{/snippet}

<svelte:head>
  <title>{m.common_loomkeep()} — {m.landing_meta_tagline()}</title>

  {#if env.PUBLIC_UMAMI_WEBSITE_ID && env.PUBLIC_UMAMI_SCRIPT_URL}
    <script
      defer
      src={env.PUBLIC_UMAMI_SCRIPT_URL}
      data-website-id={env.PUBLIC_UMAMI_WEBSITE_ID}
      data-domains={page.url.hostname}
      data-performance="true"></script>
  {/if}
</svelte:head>

<div class="min-h-screen">
  <header
    class="border-border bg-bg/85 sticky top-0 z-30 border-b backdrop-blur">
    <div
      class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
      <a href="/" class="font-display text-xl font-extrabold tracking-tight">
        {m.common_LOOM()}<span class="text-accent">{m.common_KEEP()}</span>
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

        {#if bootstrap.ready}
          {#if auth.isLoggedIn}
            <a
              href="/app"
              class="btn btn-primary"
              data-umami-event="cta-nav-open-app">
              {m.landing_open_app()}
            </a>
          {:else}
            <a
              href="/login"
              class="btn btn-ghost"
              data-umami-event="cta-nav-login">
              {m.common_login()}
            </a>
            {#if appConfig.registrationEnabled}
              <a
                href="/register"
                data-umami-event="cta-nav-register"
                class="btn btn-primary hidden sm:inline-flex">
                {m.common_register()}
              </a>
            {/if}
          {/if}
        {/if}
      </div>
    </div>

    <div class="flex h-0.75" aria-hidden="true">
      {#each SALLES as salle (salle.id)}
        <span
          class="flex-1 transition-opacity duration-300"
          style={`background: ${salle.color ?? "var(--dim)"}`}
          class:opacity-20={!picked.includes(salle.id)}></span>
      {/each}
    </div>
  </header>

  <main>
    <!-- ── Hero ────────────────────────────────────────────────────────── -->
    <section
      bind:this={heroEl}
      class="relative flex min-h-[86svh] flex-col justify-center overflow-hidden py-20">
      <div
        class="absolute inset-0 grid grid-cols-3 gap-2 p-2 sm:grid-cols-5 lg:grid-cols-8"
        aria-hidden="true">
        {#each LANDING_LIBRARY as work (work.title)}
          <Poster src={work.cover} title={work.title} class="rounded" />
        {/each}
      </div>

      <div
        class="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={`background: radial-gradient(circle 280px at ${beamX}% ${beamY}%, color-mix(in srgb, var(--bg) 84%, transparent) 0%, color-mix(in srgb, var(--bg) 84%, transparent) 44%, var(--bg) 82%)`}>
      </div>

      <div class="relative isolate mx-auto w-full max-w-5xl px-5">
        <p class="timecode text-xs tracking-[0.22em] uppercase">
          {m.landing_hero_kicker()}
        </p>
        <h1
          class="font-display mt-6 text-5xl leading-[0.95] font-extrabold tracking-[-0.035em] md:text-8xl">
          {m.landing_hero_title_lead()}<br />
          {m.landing_hero_title_sub()}
          {#key verb}
            <span class="verb" style={`color: ${VERBS[verb].color}`}>
              {VERBS[verb].word()}
            </span>
          {/key}
        </h1>
        <p class="text-dim mt-8 max-w-md text-base md:text-lg">
          {m.landing_hero_body()}
        </p>
        <div class="mt-10 flex flex-wrap gap-3">
          {@render primaryCta(
            m.common_register(),
            "cta-hero-register",
            "btn btn-primary btn-primary-cartouche btn-lg",
          )}
          <a href="#programme" class="btn btn-ghost btn-lg">
            {m.landing_hero_cta_secondary()}
          </a>
        </div>
      </div>
    </section>

    <!-- ── Les salles + comparateur ────────────────────────────────────── -->
    <section id="programme" class="border-border scroll-mt-16 border-t">
      <div class="mx-auto max-w-5xl px-5 py-20 md:py-28">
        <p class="timecode text-xs tracking-[0.22em] uppercase">
          {m.landing_programme_kicker()}
        </p>
        <h2
          class="font-display mt-5 max-w-2xl text-3xl font-extrabold tracking-tight md:text-5xl">
          {m.landing_programme_title()}
        </h2>
        <p class="text-dim mt-6 max-w-2xl">
          {m.landing_programme_body()}
        </p>

        <ul class="border-border mt-12 border-t">
          {#each SALLES as salle (salle.id)}
            {@const on = picked.includes(salle.id)}
            <li class="border-border border-b">
              <button
                type="button"
                aria-pressed={on}
                onclick={() => toggle(salle.id)}
                class="group grid w-full items-baseline gap-x-6 gap-y-1 py-6 text-left duration-200 hover:pl-3 md:grid-cols-[1.5rem_2fr_3fr_1fr]"
                class:opacity-90={!on}>
                <span
                  class="row-span-2 grid h-5 w-5 shrink-0 place-items-center self-center rounded-md border transition-colors md:row-span-1"
                  style={on && salle.color
                    ? `border-color: ${salle.color}; background: ${salle.color}`
                    : undefined}
                  class:border-border={!on || !salle.color}
                  class:bg-dim={on && !salle.color}>
                  {#if on}
                    <Icon name="check" class="text-bg h-3.5 w-3.5" />
                  {/if}
                </span>
                <span
                  class="font-display text-xl font-extrabold tracking-tight text-nowrap md:text-2xl">
                  {salle.label()}
                </span>
                <span class="text-dim text-sm">{salle.detail()}</span>
                <span
                  class="timecode text-[0.65rem] tracking-[0.16em] text-nowrap uppercase md:justify-self-end"
                  style={salle.color ? `color: ${salle.color}` : undefined}>
                  {salle.catalog}
                </span>
              </button>
            </li>
          {/each}
        </ul>

        <h3
          class="font-display mt-16 max-w-3xl text-2xl font-extrabold tracking-tight md:text-4xl">
          {m.landing_comparator_question()}
        </h3>

        <div class="mt-8 grid gap-4 md:grid-cols-2">
          <div class="border-border rounded-2xl border p-6">
            <p class="timecode text-[0.65rem] tracking-[0.16em] uppercase">
              {m.landing_comparator_existing_label()}
            </p>
            {#if picked.length === 0}
              <p class="font-display mt-4 text-5xl font-extrabold">—</p>
              <p class="text-dim mt-3 text-sm">
                {m.landing_comparator_empty_hint()}
              </p>
            {:else}
              <p class="font-display mt-4 text-5xl font-extrabold tabular-nums">
                {stack.apps.length}
              </p>
              <p class="text-dim mt-2 text-sm">
                {stack.apps.length > 1
                  ? m.landing_comparator_apps_plural()
                  : m.landing_comparator_apps_singular()}
              </p>
              <ul class="mt-4 flex flex-wrap gap-2">
                {#each stack.apps as app (app)}
                  <li
                    class="border-border text-dim rounded-lg border px-2.5 py-1 text-xs">
                    {app}
                  </li>
                {/each}
              </ul>
              {#if stack.uncovered.length > 0}
                <p class="text-danger mt-4 text-sm">
                  {m.landing_comparator_uncovered_prefix()}
                  {stack.uncovered
                    .map((s) => SALLES.find((x) => x.id === s)?.label())
                    .join(", ")}.
                </p>
              {/if}
            {/if}
          </div>

          <div class="border-accent bg-accent/5 rounded-2xl border p-6">
            <p
              class="timecode text-accent text-[0.65rem] tracking-[0.16em] uppercase">
              {m.landing_comparator_loomkeep_label()}
            </p>
            <p
              class="font-display text-accent mt-4 text-5xl font-extrabold tabular-nums">
              1
            </p>
            <p class="text-dim mt-2 text-sm">
              {m.landing_comparator_loomkeep_body()}
            </p>
            {#if pickedUnshipped.length > 0}
              <p class="text-dim mt-4 text-sm">
                <Icon
                  name="x"
                  class="text-danger mr-1 inline h-3.5 w-3.5 shrink-0" />
                {pickedUnshipped.map((s) => s.label()).join(" · ")}
                {pickedUnshipped.length > 1
                  ? m.landing_comparator_unshipped_plural()
                  : m.landing_comparator_unshipped_singular()}
              </p>
            {/if}
            <div class="mt-6">
              {@render primaryCta(
                m.landing_comparator_cta(),
                "cta-comparator-register",
                "btn btn-primary btn-lg",
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={showDetail}
          onclick={() => (showDetail = !showDetail)}
          class="btn btn-ghost mt-6">
          <Icon
            name="chevron-right"
            class="h-4 w-4 transition-transform {showDetail
              ? 'rotate-90'
              : ''}" />
          {showDetail
            ? m.landing_comparator_toggle_hide()
            : m.landing_comparator_toggle_show()}
        </button>

        {#if showDetail}
          <div class="mt-8">
            <p class="text-dim max-w-2xl text-sm">
              {m.landing_comparator_detail_note()}
            </p>

            <ul class="border-border mt-6 border-t">
              {#each RIVALS as rival (rival.name)}
                {@const hits = rival.full.filter((s) => picked.includes(s))}
                {@const partialHit =
                  rival.partial && picked.includes(rival.partial.salle)}
                <li
                  class="border-border grid gap-x-6 gap-y-2 border-b px-4 py-4 md:grid-cols-[11rem_1fr_auto] md:items-center"
                  class:opacity-40={picked.length > 0 &&
                    hits.length === 0 &&
                    !partialHit}>
                  <span class="font-display flex items-center gap-2 font-bold">
                    <span class:line-through={rival.closed}>{rival.name}</span>
                    {#if rival.selfHost}
                      <Icon name="shield" class="text-dim h-3.5 w-3.5" />
                    {/if}
                    {#if rival.closed}
                      <span
                        class="border-danger text-danger rounded-full border px-1.5 py-0.5 text-[0.62rem] font-bold uppercase">
                        {m.landing_comparator_closed_badge()}
                      </span>
                    {/if}
                  </span>
                  <span class="flex flex-wrap items-center gap-1.5">
                    {#each SALLES as salle (salle.id)}
                      {@const full = rival.full.includes(salle.id)}
                      {@const partial = rival.partial?.salle === salle.id}
                      <span
                        class="rounded px-1.5 py-0.5 text-[0.68rem] font-semibold"
                        class:opacity-25={!picked.includes(salle.id)}
                        style={full
                          ? `color: ${salle.color ?? "var(--fg)"}; background: color-mix(in srgb, ${salle.color ?? "var(--dim)"} 15%, transparent)`
                          : partial
                            ? `color: var(--dim); border: 1px dashed var(--border)`
                            : "color: var(--dim); text-decoration: line-through"}>
                        {salle.label()}{#if partial}&nbsp;· {rival.partial?.what()}{/if}
                      </span>
                    {/each}
                  </span>
                  <span class="timecode text-[0.68rem] md:text-right">
                    {rival.price()}
                  </span>
                  <span class="text-dim col-span-full text-sm">
                    {rival.note()}
                  </span>
                </li>
              {/each}

              <li
                class="border-accent bg-accent/5 grid gap-x-6 gap-y-2 border-b px-4 py-4 md:grid-cols-[11rem_1fr_auto] md:items-center">
                <span
                  class="font-display text-accent flex items-center gap-2 font-bold">
                  {m.common_loomkeep()}
                  <Icon name="shield" class="h-3.5 w-3.5" />
                </span>
                <span class="flex flex-wrap items-center gap-1.5">
                  {#each SALLES as salle (salle.id)}
                    <span
                      class="rounded px-1.5 py-0.5 text-[0.68rem] font-semibold"
                      class:opacity-25={!picked.includes(salle.id)}
                      style={salle.shipped
                        ? `color: ${salle.color}; background: color-mix(in srgb, ${salle.color} 15%, transparent)`
                        : "color: var(--dim); border: 1px dashed var(--border)"}>
                      {salle.label()}{#if !salle.shipped}&nbsp;· {m.landing_comparator_bientot()}{/if}
                    </span>
                  {/each}
                </span>
                <span class="timecode text-[0.68rem] md:text-right">
                  {m.landing_comparator_loomkeep_row_price()}
                </span>
                <span class="text-dim col-span-full text-sm">
                  {m.landing_comparator_loomkeep_row_note()}
                  <Icon name="shield" class="mx-0.5 inline h-3 w-3" />
                  {m.landing_comparator_loomkeep_row_note_trail()}
                </span>
              </li>
            </ul>
          </div>
        {/if}
      </div>
    </section>

    <!-- ── Import ──────────────────────────────────────────────────────── -->
    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-24">
        <div class="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2
              class="font-display text-2xl font-extrabold tracking-tight md:text-4xl">
              {m.landing_import_title()}
            </h2>
            <p class="text-dim mt-4">
              {m.landing_import_body()}
            </p>
            <div class="mt-6">
              {@render primaryCta(
                m.landing_import_cta(),
                "cta-import-register",
                "btn btn-primary",
              )}
            </div>
            <p class="text-dim mt-6 text-sm">
              {m.landing_import_missing_lead()}
              <a
                href={FEEDBACK_URL}
                target="_blank"
                rel="noopener noreferrer"
                class="link-accent">
                {m.landing_import_missing_link()}
              </a>.
            </p>
          </div>

          <div>
            <p class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
              {m.landing_import_available_label()}
            </p>
            <ul
              class="border-border mt-3 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2">
              {#each IMPORTS_DONE as source (source.name)}
                <li class="bg-surface px-5 py-4">
                  <p class="font-display flex items-center gap-2 font-bold">
                    <Icon name="check" class="text-success h-4 w-4 shrink-0" />
                    {source.name}
                  </p>
                  <p class="text-dim mt-0.5 text-sm">{source.what()}</p>
                  {#if source.note}
                    <p class="text-dim mt-0.5 text-xs italic">
                      {source.note()}
                    </p>
                  {/if}
                </li>
              {/each}
            </ul>

            <p class="timecode mt-8 text-[0.62rem] tracking-[0.18em] uppercase">
              {m.landing_import_todo_label()}
            </p>
            <ul class="mt-3 flex flex-wrap gap-2">
              {#each IMPORTS_TODO as source (source.name)}
                <li
                  class="border-border text-dim rounded-lg border border-dashed px-3 py-1.5 text-sm"
                  title={source.what()}>
                  {source.name}
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Le nom ──────────────────────────────────────────────────────── -->
    <section class="border-border border-t">
      <div
        class="mx-auto grid max-w-5xl gap-12 px-5 py-20 md:py-28 lg:grid-cols-2">
        <div>
          <p class="timecode text-xs tracking-[0.22em] uppercase">
            {m.landing_name_kicker()}
          </p>
          <h2
            class="font-display mt-5 text-2xl font-extrabold tracking-tight md:text-3xl">
            {m.landing_name_title()}
          </h2>
          <p class="text-dim mt-5">
            {m.landing_name_body1()}
          </p>
          <p class="text-dim mt-4">
            {m.landing_name_body2()}
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-umami-event="cta-name-selfhost"
              class="btn btn-ghost">
              {m.landing_source_cta()}
            </a>
          </div>
        </div>

        <dl
          class="border-border flex h-fit flex-col gap-7 self-center rounded-2xl border p-7">
          <div>
            <dt class="font-display text-accent text-2xl font-extrabold">
              {m.common_loom()}
            </dt>
            <dd class="text-dim mt-2 text-sm">
              {m.landing_name_loom_body()}
            </dd>
          </div>
          <div>
            <dt class="font-display text-accent text-2xl font-extrabold">
              {m.common_keep()}
            </dt>
            <dd class="text-dim mt-2 text-sm">
              {m.landing_name_keep_body()}
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- ── CTA final ───────────────────────────────────────────────────── -->
    <section class="border-border border-t">
      <div class="mx-auto max-w-3xl px-5 py-24 text-center md:py-28">
        <h2
          class="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
          {m.landing_final_title({ tabs: tabsLabel })}
        </h2>
        <p class="text-dim mx-auto mt-6 max-w-xl">
          {m.landing_final_body()}
        </p>
        <div class="mt-9 flex flex-wrap justify-center gap-3">
          {@render primaryCta(
            m.landing_comparator_cta(),
            "cta-final-register",
            "btn btn-primary btn-primary-cartouche btn-lg",
          )}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-umami-event="cta-final-selfhost"
            class="btn btn-ghost btn-lg">
            <Icon name="shield" class="h-4 w-4" />
            {m.landing_source_cta()}
          </a>
        </div>
      </div>
    </section>
  </main>

  <LandingFooter />
</div>

<style>
  .verb {
    display: inline-block;
    animation: cut 0.4s ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .verb {
      animation: none;
    }
  }

  @keyframes cut {
    from {
      opacity: 0;
      transform: translateY(0.12em);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
