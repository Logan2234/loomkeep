<script lang="ts">
  // Prototype 6 — "Le comparateur". The hero is an argument you operate: tick
  // what you actually track, and the page counts how many existing apps it
  // would take to cover it. No app screenshots, no walkthrough — the
  // interaction is the positioning.
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import { GITHUB_REPO_URL } from "$lib/constants/external-links";
  import LandingFooter from "../components/LandingFooter.svelte";
  import {
    DOMAIN_COLOR,
    IMPORTS,
    LIBRARY,
    type MockDomain,
  } from "../components/mock-data";

  const DOMAINS: { id: MockDomain; label: string }[] = [
    { id: "series", label: "Séries" },
    { id: "movies", label: "Films" },
    { id: "anime", label: "Animes" },
    { id: "games", label: "Jeux" },
    { id: "books", label: "Livres" },
    { id: "music", label: "Albums" },
  ];

  // Coverage as advertised by each service. These claims are the ones a
  // visitor can check in five minutes, so they stay factual and dated.
  const RIVALS: {
    name: string;
    domains: MockDomain[];
    price: string;
    note: string;
  }[] = [
    {
      name: "Trakt",
      domains: ["series", "movies", "anime"],
      price: "gratuit limité, VIP payant",
      note: "Le suivi de base est gratuit, une partie des fonctions est réservée aux abonnés.",
    },
    {
      name: "TV Time",
      domains: ["series", "movies", "anime"],
      price: "gratuit avec publicité",
      note: "Mobile avant tout, financé par la publicité.",
    },
    {
      name: "Simkl",
      domains: ["series", "movies", "anime"],
      price: "gratuit avec publicité",
      note: "Couvre les trois formats vidéo, s'arrête là.",
    },
    {
      name: "Letterboxd",
      domains: ["movies"],
      price: "gratuit, Pro payant",
      note: "Le meilleur pour les films, et uniquement pour les films.",
    },
    {
      name: "Goodreads",
      domains: ["books"],
      price: "gratuit",
      note: "Propriété d'Amazon, exploite tes lectures.",
    },
    {
      name: "StoryGraph",
      domains: ["books"],
      price: "gratuit, Plus payant",
      note: "Livres uniquement, mais bien fait.",
    },
    {
      name: "Backloggd",
      domains: ["games"],
      price: "gratuit",
      note: "Jeux uniquement.",
    },
  ];

  let picked = $state<MockDomain[]>(["series", "games", "books"]);

  function toggle(id: MockDomain) {
    picked = picked.includes(id)
      ? picked.filter((d) => d !== id)
      : [...picked, id];
  }

  // Plain function, not a $derived: it takes an argument, and the template
  // effect that calls it already re-runs when `picked` changes.
  function covers(rival: (typeof RIVALS)[number]) {
    return picked.filter((d) => rival.domains.includes(d));
  }

  // How many existing services it takes to cover the selection — a plain
  // greedy set cover, which is what someone would do by hand anyway.
  const stack = $derived.by(() => {
    const remaining = new Set(picked);
    const chosen: string[] = [];
    while (remaining.size > 0) {
      let best: (typeof RIVALS)[number] | null = null;
      let bestGain = 0;
      for (const rival of RIVALS) {
        const gain = rival.domains.filter((d) => remaining.has(d)).length;
        if (gain > bestGain) {
          best = rival;
          bestGain = gain;
        }
      }
      if (!best) break;
      chosen.push(best.name);
      for (const d of best.domains) remaining.delete(d);
    }
    return { apps: chosen, uncovered: [...remaining] };
  });

  const sample = $derived(
    LIBRARY.filter((work) => picked.includes(work.domain)).slice(0, 8),
  );

  let importSource = $state(IMPORTS[0].name);
  const importDetail = $derived(
    IMPORTS.find((i) => i.name === importSource) ?? IMPORTS[0],
  );

  const EDGES = [
    {
      title: "Un revisionnage ne remplace pas le premier",
      body: "Reprendre une série depuis le début ne remet pas ton compteur à zéro. Chaque passage est gardé avec sa date, et l'entrée passe à ×2.",
    },
    {
      title: "Les domaines que tu n'utilises pas disparaissent",
      body: "Tu ne suis pas d'albums ? Le domaine sort de la navigation, de la recherche et des statistiques. Tu ne payes pas en encombrement ce que tu n'utilises pas.",
    },
    {
      title: "Ce que tu possèdes, à part de ce que tu as vu",
      body: "Blu-ray, achat dématérialisé, abonnement, emprunté. La plupart des trackers confondent « vu » et « possédé ».",
    },
    {
      title: "Les sorties dans ton vrai agenda",
      body: "Les prochains épisodes s'abonnent en iCal dans Google Agenda, Apple Calendrier ou Thunderbird. Pas besoin d'ouvrir l'app pour savoir.",
    },
    {
      title: "Ton export, sans condition",
      body: "CSV par domaine ou archive JSON complète, à tout moment. La porte de sortie est ouverte avant même que tu entres.",
    },
    {
      title: "Chez toi si tu veux",
      body: "Le code est public sous AGPL et la pile Docker est fournie. Si l'instance publique ferme un jour, ta bibliothèque n'est pas otage.",
    },
  ];
</script>

<svelte:head>
  <title>Loomkeep — prototype 6 · Le comparateur</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <header
    class="border-border bg-bg/85 sticky top-0 z-20 border-b backdrop-blur">
    <div
      class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
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
    <div class="flex h-[3px]" aria-hidden="true">
      {#each DOMAINS as domain (domain.id)}
        <span
          class="flex-1 transition-opacity"
          style={`background: ${DOMAIN_COLOR[domain.id]}`}
          class:opacity-25={!picked.includes(domain.id)}></span>
      {/each}
    </div>
  </header>

  <main class="flex-1">
    <section class="mx-auto max-w-5xl px-5 pt-14 pb-8 md:pt-20">
      <p class="timecode text-xs tracking-[0.18em] uppercase">
        Suivi de collection · gratuit · open source
      </p>
      <h1
        class="font-display mt-5 max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight md:text-6xl">
        Combien d'applications te faut-il
        <span class="text-accent">pour suivre tout ça&nbsp;?</span>
      </h1>
      <p class="text-dim mt-6 max-w-2xl md:text-lg">
        Coche ce que tu suis vraiment. Le compte se fait tout seul.
      </p>

      <!-- The comparator. Ticking a domain rewrites the count below. -->
      <div class="mt-8 flex flex-wrap gap-2">
        {#each DOMAINS as domain (domain.id)}
          {@const on = picked.includes(domain.id)}
          <button
            type="button"
            class="chip inline-flex items-center gap-2"
            class:chip-on={on}
            aria-pressed={on}
            onclick={() => toggle(domain.id)}>
            <span
              class="h-2 w-2 rounded-full"
              style={`background: ${on ? "currentColor" : DOMAIN_COLOR[domain.id]}`}
            ></span>
            {domain.label}
          </button>
        {/each}
      </div>

      <div class="mt-8 grid gap-4 md:grid-cols-2">
        <div class="border-border rounded-2xl border p-6">
          <p class="timecode text-[0.65rem] tracking-[0.16em] uppercase">
            Avec les outils existants
          </p>
          {#if picked.length === 0}
            <p class="font-display mt-4 text-3xl font-extrabold">—</p>
            <p class="text-dim mt-3 text-sm">
              Coche au moins un domaine au-dessus.
            </p>
          {:else}
            <p class="font-display mt-4 text-5xl font-extrabold tabular-nums">
              {stack.apps.length}
            </p>
            <p class="text-dim mt-2 text-sm">
              {stack.apps.length > 1
                ? "applications, autant de comptes, aucune vue d'ensemble"
                : "application — et rien pour le reste de ta collection"}
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
                Personne ne couvre :
                {stack.uncovered
                  .map((d) => DOMAINS.find((x) => x.id === d)?.label)
                  .join(", ")}.
              </p>
            {/if}
          {/if}
        </div>

        <div class="border-accent bg-accent/5 rounded-2xl border p-6">
          <p
            class="timecode text-accent text-[0.65rem] tracking-[0.16em] uppercase">
            Avec Loomkeep
          </p>
          <p
            class="font-display text-accent mt-4 text-5xl font-extrabold tabular-nums">
            1
          </p>
          <p class="text-dim mt-2 text-sm">
            Une bibliothèque, une page de statistiques, un export. Les six
            domaines sont couverts, y compris ceux que personne d'autre ne
            prend.
          </p>
          <a href="/register" class="btn btn-primary btn-lg mt-6">
            Créer mon compte
          </a>
        </div>
      </div>

      {#if sample.length > 0}
        <div class="mt-8">
          <p class="timecode mb-3 text-[0.65rem] tracking-[0.16em] uppercase">
            Ta bibliothèque ressemblerait à ça
          </p>
          <div class="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {#each sample as work (work.title)}
              <div class="w-20 shrink-0 sm:w-24">
                <div class="card overflow-hidden">
                  <Poster src={work.cover} title={work.title} />
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Le détail, service par service
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          Ce que chacun couvre, pour la sélection que tu viens de faire.
        </p>

        <ul class="border-border mt-8 border-t">
          {#each RIVALS as rival (rival.name)}
            {@const hits = covers(rival)}
            <li
              class="border-border grid gap-x-6 gap-y-2 border-b py-4 md:grid-cols-[10rem_1fr_auto] md:items-center"
              class:opacity-45={picked.length > 0 && hits.length === 0}>
              <span class="font-display font-bold">{rival.name}</span>
              <span class="flex flex-wrap items-center gap-1.5">
                {#each DOMAINS as domain (domain.id)}
                  {@const has = rival.domains.includes(domain.id)}
                  {@const wanted = picked.includes(domain.id)}
                  <span
                    class="rounded px-1.5 py-0.5 text-[0.68rem] font-semibold"
                    class:opacity-25={!wanted}
                    style={has
                      ? `color: ${DOMAIN_COLOR[domain.id]}; background: color-mix(in srgb, ${DOMAIN_COLOR[domain.id]} 15%, transparent)`
                      : "color: var(--dim); text-decoration: line-through"}>
                    {domain.label}
                  </span>
                {/each}
              </span>
              <span class="timecode text-[0.68rem] md:text-right">
                {rival.price}
              </span>
              <span class="text-dim col-span-full text-sm">{rival.note}</span>
            </li>
          {/each}

          <li
            class="border-accent bg-accent/5 grid gap-x-6 gap-y-2 border-b py-4 md:grid-cols-[10rem_1fr_auto] md:items-center">
            <span class="font-display text-accent font-bold">Loomkeep</span>
            <span class="flex flex-wrap items-center gap-1.5">
              {#each DOMAINS as domain (domain.id)}
                <span
                  class="rounded px-1.5 py-0.5 text-[0.68rem] font-semibold"
                  class:opacity-25={!picked.includes(domain.id)}
                  style={`color: ${DOMAIN_COLOR[domain.id]}; background: color-mix(in srgb, ${DOMAIN_COLOR[domain.id]} 15%, transparent)`}>
                  {domain.label}
                </span>
              {/each}
            </span>
            <span class="timecode text-[0.68rem] md:text-right">
              gratuit, sans publicité
            </span>
            <span class="text-dim col-span-full text-sm">
              Podcasts et jeux de société sont annoncés et pas encore développés
              — autant le dire ici plutôt que dans une note de bas de page.
            </span>
          </li>
        </ul>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Et ton historique te suit
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          Changer d'outil coûte cher quand il faut tout ressaisir. Choisis d'où
          tu viens.
        </p>

        <div class="mt-8 flex flex-wrap gap-2">
          {#each IMPORTS as source (source.name)}
            <button
              type="button"
              class="chip"
              class:chip-on={importSource === source.name}
              aria-pressed={importSource === source.name}
              onclick={() => (importSource = source.name)}>
              {source.name}
            </button>
          {/each}
        </div>

        <div class="border-border mt-6 rounded-2xl border p-6">
          <p class="font-display text-lg font-bold">
            Depuis {importDetail.name}, Loomkeep reprend&nbsp;:
          </p>
          <p class="text-dim mt-2">{importDetail.what}</p>
          <p class="text-dim mt-4 text-sm">
            L'import se fait collection par collection : tu vois ce qui a été
            reconnu et ce qui ne l'a pas été, et tu valides avant que quoi que
            ce soit entre dans ta bibliothèque.
          </p>
        </div>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Six différences que tu remarqueras à l'usage
        </h2>
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each EDGES as edge (edge.title)}
            <div class="card p-5">
              <h3 class="font-display text-base font-bold">{edge.title}</h3>
              <p class="text-dim mt-2 text-sm">{edge.body}</p>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-3xl px-5 py-20 text-center md:py-24">
        <h2
          class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Une application au lieu de trois.
        </h2>
        <p class="text-dim mx-auto mt-5 max-w-xl">
          Gratuit, sans publicité, développé par une seule personne et publié en
          open source. Une adresse email suffit pour commencer.
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
