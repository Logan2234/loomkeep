<script lang="ts">
  // Prototype 7 — "La collection". The hero is a wall of real covers you can
  // click: each work opens what Loomkeep keeps about it, and each one is
  // chosen to show a different capability. Features are discovered through
  // the collection instead of being listed or demonstrated screen by screen.
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { GITHUB_REPO_URL } from "$lib/constants/external-links";
  import LandingFooter from "../components/LandingFooter.svelte";
  import {
    DOMAIN_COLOR,
    DOMAIN_LABEL,
    IMPORTS,
    LIBRARY,
    type MockEntry,
  } from "../components/mock-data";

  interface Facet {
    /** The capability this work is here to show. */
    feature: string;
    /** The tracked value itself, in the app's own vocabulary. */
    value: string;
    body: string;
    /** Extra rows, rendered as a small key/value list. */
    rows?: [string, string][];
  }

  // One work per capability. The order is the reading order of the wall.
  const FACETS: Record<string, Facet> = {
    Severance: {
      feature: "Suivi épisode par épisode",
      value: "4 / 10 épisodes · saison 2",
      body: "Tu coches, le statut et la progression se recalculent. Le prochain épisode part dans ton calendrier sans que tu aies rien à faire.",
      rows: [
        ["Prochain", "S02E05 · Trojan's Horse"],
        ["Statut", "En cours (déduit, jamais saisi)"],
        ["Diffusion", "en cours"],
      ],
    },
    "Everything Everywhere All at Once": {
      feature: "Les revisionnages sont gardés",
      value: "Vu 2 fois",
      body: "Un second visionnage n'écrase pas le premier : il s'ajoute avec sa date. La plupart des trackers remettent simplement le compteur à zéro.",
      rows: [
        ["1er visionnage", "14 mai 2023"],
        ["2e visionnage", "2 février 2026"],
        ["Note", "★ 10"],
      ],
    },
    Piranesi: {
      feature: "Progression en pages",
      value: "page 148 sur 240",
      body: "Un livre n'a pas d'épisodes : la progression se compte en pages, et alimente ton objectif de lecture annuel.",
      rows: [
        ["Objectif 2026", "18 / 30 livres"],
        ["Possession", "Papier"],
      ],
    },
    "Blue Prince": {
      feature: "Temps de jeu et état",
      value: "En cours · 18 h",
      body: "Un jeu se suit par son état — à faire, en cours, terminé, abandonné — et son temps de jeu. « À faire » sert aussi de liste d'envies.",
      rows: [
        ["Possession", "Abonnement · Game Pass"],
        ["Import", "repris de Steam"],
      ],
    },
    BRAT: {
      feature: "Volontairement binaire",
      value: "Écouté · ★ 8",
      body: "Un album se prend d'un bloc : il est écouté ou il ne l'est pas. Inventer un « en cours » pour 40 minutes de musique n'aurait servi à rien.",
      rows: [["Ajouté", "9 juin 2024"]],
    },
    "Dune, deuxième partie": {
      feature: "Ce que tu possèdes",
      value: "Blu-ray · vu",
      body: "Loomkeep sépare ce que tu as vu de ce que tu possèdes. Utile le jour où tu regardes ton étagère en te demandant si tu l'as déjà.",
      rows: [
        ["Possession", "Physique · Blu-ray 4K"],
        ["Note", "★ 9"],
      ],
    },
    Arcane: {
      feature: "Notes et critiques",
      value: "Terminé · ★ 10",
      body: "Une critique sur l'œuvre, une saison ou un épisode précis, avec avertissement spoiler. Ou juste une note privée que personne ne verra.",
      rows: [
        ["Critique", "publiée"],
        ["Profil", "privé par défaut"],
      ],
    },
    Frieren: {
      feature: "Les animes ont leur catalogue",
      value: "18 / 28 épisodes",
      body: "Les séries et les films viennent de TMDB, les animes d'AniList. Deux catalogues, parce qu'aucun des deux ne fait bien le travail de l'autre.",
      rows: [
        ["Catalogue", "AniList"],
        ["Prochain", "E19"],
      ],
    },
  };

  const FEATURED = Object.keys(FACETS);

  let selected = $state("Severance");
  // Grows as the visitor opens covers — the counter is a reward for
  // exploring, not a position indicator.
  let explored = $state<string[]>(["Severance"]);

  function open(title: string) {
    selected = title;
    if (!explored.includes(title)) explored = [...explored, title];
  }

  const work = $derived(
    LIBRARY.find((w) => w.title === selected) ?? LIBRARY[0],
  );
  const facet = $derived(FACETS[selected] ?? FACETS.Severance);

  /** The wall: featured works first, the rest as filler behind them. */
  const WALL: MockEntry[] = [
    ...FEATURED.map((t) => LIBRARY.find((w) => w.title === t)!),
    ...LIBRARY.filter((w) => !FEATURED.includes(w.title)),
  ];
</script>

<svelte:head>
  <title>Loomkeep — prototype 7 · La collection</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <header
    class="border-border bg-bg/85 sticky top-0 z-20 border-b backdrop-blur">
    <div
      class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 md:px-8">
      <span class="font-display text-xl font-extrabold tracking-tight">
        LOOM<span class="text-accent">KEEP</span>
      </span>
      <div class="flex items-center gap-2">
        <a href="/login" class="btn btn-ghost">Se connecter</a>
        <a href="/register" class="btn btn-primary hidden sm:inline-flex">
          Créer un compte
        </a>
      </div>
    </div>
  </header>

  <main class="flex-1">
    <section class="mx-auto max-w-6xl px-5 pt-12 pb-6 md:px-8 md:pt-16">
      <p class="timecode text-xs tracking-[0.18em] uppercase">
        Suivi de collection · gratuit · open source
      </p>
      <h1
        class="font-display mt-5 max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight md:text-6xl">
        Ta collection, et ce que
        <span class="text-accent">Loomkeep en retient.</span>
      </h1>
      <p class="text-dim mt-6 max-w-2xl md:text-lg">
        Séries, films, animes, jeux, livres et albums dans une seule
        bibliothèque. Clique sur une affiche : chacune montre une chose que
        l'app garde et que les autres perdent.
      </p>
    </section>

    <!-- The wall on the left, the opened work on the right. On mobile the
         panel comes first, so a tap always has a visible effect. -->
    <section class="mx-auto max-w-6xl px-5 pb-14 md:px-8 md:pb-20">
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div class="order-2 lg:order-1">
          <div
            class="grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-6"
            role="group"
            aria-label="Choisir une œuvre de la collection">
            {#each WALL as entry (entry.title)}
              {@const isFeatured = FEATURED.includes(entry.title)}
              {@const isOn = selected === entry.title}
              <button
                type="button"
                disabled={!isFeatured}
                aria-pressed={isOn}
                aria-label={entry.title}
                onclick={() => open(entry.title)}
                class="group relative overflow-hidden rounded-lg border transition-[transform,border-color,opacity] {isOn
                  ? 'border-accent -translate-y-0.5'
                  : 'border-border'} {isFeatured
                  ? 'hover:border-accent cursor-pointer hover:-translate-y-0.5'
                  : 'cursor-default opacity-35'}">
                <Poster src={entry.cover} title={entry.title} />
                {#if isFeatured && !isOn}
                  <span
                    class="bg-bg/70 text-fg absolute right-1.5 bottom-1.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold backdrop-blur-sm">
                    +
                  </span>
                {/if}
              </button>
            {/each}
          </div>
          <p class="text-dim mt-4 text-sm">
            Les affiches en relief sont cliquables. Les autres sont là pour ce
            qu'elles sont : une bibliothèque qui se remplit.
          </p>
        </div>

        <div class="order-1 lg:order-2">
          <div class="lg:sticky lg:top-24">
            <div class="card p-5">
              <div class="flex gap-4">
                <div class="w-20 shrink-0 overflow-hidden rounded-lg sm:w-24">
                  <Poster src={work.cover} title={work.title} />
                </div>
                <div class="min-w-0 flex-1">
                  <span
                    class="timecode text-[0.65rem] tracking-[0.16em] uppercase"
                    style={`color: ${DOMAIN_COLOR[work.domain]}`}>
                    {DOMAIN_LABEL[work.domain]} · {work.year}
                  </span>
                  <h2
                    class="font-display mt-1 text-xl leading-tight font-extrabold">
                    {work.title}
                  </h2>
                  <p class="timecode mt-2 text-sm">{facet.value}</p>
                </div>
              </div>

              <div class="border-border mt-5 border-t pt-5">
                <p
                  class="timecode text-accent text-[0.65rem] tracking-[0.16em] uppercase">
                  {facet.feature}
                </p>
                <p class="text-dim mt-3 text-sm">{facet.body}</p>
              </div>

              {#if facet.rows}
                <dl class="border-border mt-5 border-t pt-3">
                  {#each facet.rows as [key, value] (key)}
                    <div
                      class="border-border flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0">
                      <dt class="text-dim text-sm">{key}</dt>
                      <dd class="timecode text-xs">{value}</dd>
                    </div>
                  {/each}
                </dl>
              {/if}
            </div>

            <div class="mt-4 flex flex-wrap gap-3">
              <a href="/register" class="btn btn-primary btn-lg">
                Créer mon compte
              </a>
              <span class="text-dim self-center text-sm">
                {explored.length} / {FEATURED.length} explorées
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Pourquoi pas Trakt, Letterboxd ou Goodreads&nbsp;?
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          Parce qu'il en faudrait trois, et qu'aucun des trois ne parle aux
          autres. Loomkeep couvre les six domaines d'un seul compte, sans
          publicité et sans revendre ce que tu regardes.
        </p>

        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {#each [{ n: "6", t: "domaines dans une bibliothèque", d: "Quatre disponibles, deux annoncés." }, { n: "6", t: "imports depuis la concurrence", d: "TV Time, Trakt, Simkl, Steam, Goodreads, StoryGraph." }, { n: "0", t: "publicité, traceur, revente", d: "Le modèle est ouvert, pas financé par toi." }, { n: "1", t: "clic pour tout exporter", d: "CSV par domaine ou archive JSON complète." }] as fact (fact.t)}
            <div class="card p-5">
              <p class="font-display text-4xl font-extrabold tabular-nums">
                {fact.n}
              </p>
              <p class="mt-2 text-sm font-semibold">{fact.t}</p>
              <p class="text-dim mt-1 text-sm">{fact.d}</p>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <div class="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2
              class="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Ta collection existe déjà ailleurs
            </h2>
            <p class="text-dim mt-4">
              Rien de plus décourageant que de tout ressaisir. L'import reprend
              ton historique, collection par collection, en te montrant ce qui a
              été reconnu avant d'écrire quoi que ce soit.
            </p>
            <a href="/register" class="btn btn-primary mt-6">
              Importer ma bibliothèque
            </a>
          </div>

          <ul
            class="border-border grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2">
            {#each IMPORTS as source (source.name)}
              <li class="bg-surface px-5 py-4">
                <p class="font-display font-bold">{source.name}</p>
                <p class="text-dim mt-0.5 text-sm">{source.what}</p>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-3xl px-5 py-20 text-center md:py-24">
        <h2
          class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Ta collection mérite mieux que quatre onglets.
        </h2>
        <p class="text-dim mx-auto mt-5 max-w-xl">
          Gratuit, sans publicité, open source, développé par une seule
          personne. Tu peux tout exporter ou tout supprimer quand tu veux —
          c'est écrit avant l'inscription, pas après.
        </p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/register"
            class="btn btn-primary btn-primary-cartouche btn-lg">
            Créer mon compte
          </a>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost btn-lg">
            <Icon name="shield" class="h-4 w-4" /> Voir le code
          </a>
        </div>
      </div>
    </section>
  </main>

  <LandingFooter />
</div>
