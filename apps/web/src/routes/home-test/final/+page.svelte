<script lang="ts">
  // Assembled prototype: the sections Logan kept, in his order.
  //
  //   hero          → prototype 3 (rotating verb over the lit poster wall)
  //   les salles    → prototype 3's "Six salles, un seul billet" merged with
  //                   prototype 6's comparator: the salles are now selectable
  //                   and drive the count, the detail table and the final CTA
  //   import        → prototype 7's block, retitled, with the sources that
  //                   don't exist yet shown as such
  //   le nom        → prototype 3
  //   CTA final     → prototype 7, its number wired to the comparator
  //
  // Everything not kept is re-rendered after the footer, grouped by origin.
  import Poster from "$lib/components/Poster.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { FEEDBACK_URL, GITHUB_REPO_URL } from "$lib/constants/external-links";
  import AppendixSections from "../components/AppendixSections.svelte";
  import SiteFooter from "../components/SiteFooter.svelte";
  import { LIBRARY } from "../components/mock-data";

  type Salle =
    "video" | "games" | "books" | "music" | "podcasts" | "boardgames";

  const SALLES: {
    id: Salle;
    label: string;
    detail: string;
    catalog: string;
    color: string | null;
    /** false = announced in the settings, no screens behind it yet. */
    shipped: boolean;
  }[] = [
    {
      id: "video",
      label: "Films, séries et animes",
      detail: "Suivi épisode par épisode, saisons et revisionnages.",
      catalog: "TMDB · AniList",
      color: "var(--stat-media)",
      shipped: true,
    },
    {
      id: "games",
      label: "Jeux",
      detail: "À faire, en cours, terminé ou abandonné, avec le temps de jeu.",
      catalog: "IGDB",
      color: "var(--stat-games)",
      shipped: true,
    },
    {
      id: "books",
      label: "Livres",
      detail: "Progression en pages et objectif de lecture annuel.",
      catalog: "Open Library",
      color: "var(--stat-books)",
      shipped: true,
    },
    {
      id: "music",
      label: "Albums",
      detail: "À écouter ou écouté : un album se prend d'un bloc.",
      catalog: "MusicBrainz",
      color: "var(--stat-music)",
      shipped: true,
    },
    {
      id: "podcasts",
      label: "Podcasts",
      detail: "Annoncé dans les réglages, pas encore développé.",
      catalog: "Bientôt",
      color: null,
      shipped: false,
    },
    {
      id: "boardgames",
      label: "Jeux de société",
      detail: "Annoncé dans les réglages, pas encore développé.",
      catalog: "Bientôt",
      color: null,
      shipped: false,
    },
  ];

  // Competing services, including the two domains Loomkeep hasn't shipped —
  // pretending nobody covers podcasts or board games would be dishonest.
  // `full` counts towards the app tally, `partial` only shows in the table.
  const RIVALS: {
    name: string;
    full: Salle[];
    partial?: { salle: Salle; what: string };
    price: string;
    note: string;
    /** Self-hosted only, no managed free instance — excluded from the tally
     * below, since "sign up" and "run your own server" aren't the same ask. */
    selfHost?: boolean;
    /** No longer operating — excluded from the tally, kept in the table as
     * a data point of its own. */
    closed?: boolean;
  }[] = [
    {
      name: "Trakt",
      full: ["video"],
      price: "VIP à 60 $/an (+100 % mi-2025)",
      note: "Séries, films et animes. Depuis 2025 le compte gratuit est plafonné à deux listes de 100 œuvres.",
    },
    {
      name: "Simkl",
      full: ["video"],
      price: "gratuit, Premium à 4,49 $/mois sans pub",
      note: "Suivi illimité gratuit ; son vrai atout est le pointage automatique depuis Netflix, Crunchyroll ou Hulu.",
    },
    {
      name: "TV Time",
      full: ["video"],
      price: "fermé le 15 juillet 2026",
      note: "Racheté puis arrêté par sa maison mère, partie faire de l'IA. 26 millions de comptes perdus d'un coup — l'argument le plus concret pour un export qui marche vraiment.",
      closed: true,
    },
    {
      name: "Letterboxd",
      full: [],
      partial: { salle: "video", what: "films uniquement" },
      price: "gratuit, Pro/Patron payants",
      note: "La référence sur le cinéma. Ni séries ni animes.",
    },
    {
      name: "Serializd",
      full: [],
      partial: { salle: "video", what: "séries uniquement" },
      price: "gratuit, sans palier payant",
      note: "Le pendant de Letterboxd pour les séries. Aucune fonction derrière un abonnement.",
    },
    {
      name: "Backloggd",
      full: ["games"],
      price: "gratuit (soutien optionnel à 3 $/mois)",
      note: "Jeux vidéo uniquement, orienté critique et notation.",
    },
    {
      name: "HowLongToBeat",
      full: [],
      partial: { salle: "games", what: "durée de vie" },
      price: "gratuit",
      note: "Sert à savoir combien d'heures un jeu prend avant de l'acheter, pas à tenir une bibliothèque.",
    },
    {
      name: "Goodreads",
      full: ["books"],
      price: "gratuit",
      note: "Propriété d'Amazon. Tes lectures nourrissent leurs recommandations.",
    },
    {
      name: "StoryGraph",
      full: ["books"],
      price: "gratuit, Plus à 4,99 $/mois",
      note: "Livres uniquement, mais soigné et indépendant.",
    },
    {
      name: "Babelio",
      full: ["books"],
      price: "gratuit sous 300 livres, puis ~10 €/an",
      note: "Livres, avec une communauté francophone active et de la publicité.",
    },
    {
      name: "BookWyrm",
      full: ["books"],
      price: "gratuit",
      note: "Livres, fédéré, auto-hébergeable et sans aucune publicité — la même philosophie, un seul domaine.",
      selfHost: true,
    },
    {
      name: "Last.fm",
      full: ["music"],
      price: "gratuit, Pro à 4,99 $/mois",
      note: "Pointage automatique de ce que tu écoutes, pas une bibliothèque que tu tiens toi-même.",
    },
    {
      name: "RateYourMusic",
      full: ["music"],
      price: "gratuit avec publicité, 60 $/an sans",
      note: "Notation et listes, catalogue très complet.",
    },
    {
      name: "Discogs",
      full: [],
      partial: { salle: "music", what: "collection physique" },
      price: "gratuit",
      note: "Fait pour les vinyles et le marché de l'occasion, pas pour le suivi d'écoute.",
    },
    {
      name: "AntennaPod",
      full: ["podcasts"],
      price: "gratuit, open source, sans publicité",
      note: "Lecteur de podcasts libre, qui garde ta progression par épisode.",
    },
    {
      name: "Podcast Addict",
      full: ["podcasts"],
      price: "gratuit avec publicité, Premium ~11 $/an",
      note: "Lecteur de podcasts, Android seulement.",
    },
    {
      name: "BoardGameGeek",
      full: ["boardgames"],
      price: "gratuit avec publicité",
      note: "La base de données de référence, et un suivi de parties.",
    },
    {
      name: "BG Stats",
      full: ["boardgames"],
      price: "achat unique ~6 $",
      note: "Suivi de parties, se synchronise avec BoardGameGeek. Pas d'abonnement.",
    },
    {
      name: "Ryot",
      full: ["video", "games", "books", "music", "podcasts"],
      price: "démo instable, Pro payant même en self-host",
      note: "Le concurrent le plus proche en ambition : vidéo, jeux, livres, musique et podcasts dans un seul outil auto-hébergé. Mais il n'a pas d'instance gratuite prête à l'emploi — seule une démo dont les données sont effacées au hasard — et le partage ou les recommandations restent payants même sur ton propre serveur.",
      selfHost: true,
    },
  ];

  const VERBS = [
    { word: "vu.", color: "var(--stat-media)" },
    { word: "joué.", color: "var(--stat-games)" },
    { word: "lu.", color: "var(--stat-books)" },
    { word: "écouté.", color: "var(--stat-music)" },
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

  // Greedy set cover: how many existing services it takes to cover the
  // selection. Partial coverage doesn't count — half a domain isn't a tracker.
  // Self-hosted-only and closed rivals are excluded from the count: "sign up
  // for an app" and "provision your own server" aren't the same ask, and a
  // shut-down service can't replace anything today. Both stay in the detail
  // table below — they're real data points, just not comparable ones here.
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

  // Wires the closing headline to the comparator: "quatre onglets" only makes
  // sense when the count is actually above one.
  const tabsLabel = $derived(
    stack.apps.length > 1
      ? `${stack.apps.length} onglets`
      : "plusieurs onglets",
  );

  const IMPORTS_DONE = [
    { name: "TV Time", what: "Séries et épisodes vus" },
    { name: "Trakt", what: "Historique, watchlist et notes" },
    { name: "Simkl", what: "Séries, films et animes" },
    { name: "Steam", what: "Bibliothèque et temps de jeu" },
    { name: "Goodreads", what: "Lectures, dates et notes (CSV)" },
    { name: "StoryGraph", what: "Lectures, dates et notes (CSV)" },
  ];

  // Not built. Listed anyway, because hiding the gaps is how a landing page
  // starts lying.
  const IMPORTS_TODO = [
    { name: "Letterboxd", what: "Films notés et journal" },
    { name: "Serializd", what: "Séries suivies" },
    { name: "IMDb", what: "Watchlist et notes" },
    { name: "Backloggd", what: "Bibliothèque de jeux" },
    { name: "Last.fm", what: "Historique d'écoute" },
    { name: "RateYourMusic", what: "Albums notés" },
    { name: "Babelio", what: "Lectures et notes" },
    { name: "BoardGameGeek", what: "Collection et parties" },
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
</script>

<svelte:head>
  <title>Loomkeep — prototype final</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <header
    class="border-border bg-bg/85 sticky top-0 z-30 border-b backdrop-blur">
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
    <!-- Reflects the salles picked below: the strip is the selection, seen
         from the top of the page. -->
    <div class="flex h-[3px]" aria-hidden="true">
      {#each SALLES as salle (salle.id)}
        <span
          class="flex-1 transition-opacity duration-300"
          style={`background: ${salle.color ?? "var(--dim)"}`}
          class:opacity-20={!picked.includes(salle.id)}></span>
      {/each}
    </div>
  </header>

  <main class="flex-1">
    <!-- ── Hero (prototype 3) ─────────────────────────────────────────── -->
    <section
      bind:this={heroEl}
      class="relative flex min-h-[86svh] flex-col justify-center overflow-hidden py-20">
      <div
        class="absolute inset-0 grid grid-cols-3 gap-2 p-2 sm:grid-cols-5 lg:grid-cols-8"
        aria-hidden="true">
        {#each LIBRARY as work (work.title)}
          <Poster src={work.cover} title={work.title} class="rounded" />
        {/each}
      </div>
      <div
        class="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={`background: radial-gradient(circle 280px at ${beamX}% ${beamY}%, color-mix(in srgb, var(--bg) 8%, transparent) 0%, color-mix(in srgb, var(--bg) 76%, transparent) 44%, var(--bg) 80%)`}>
      </div>

      <div class="relative mx-auto w-full max-w-5xl px-5">
        <p class="timecode text-xs tracking-[0.22em] uppercase">
          Séance permanente · entrée libre
        </p>
        <h1
          class="font-display mt-6 text-5xl leading-[0.95] font-extrabold tracking-[-0.035em] md:text-8xl">
          Tout ce que<br />tu as
          {#key verb}
            <span class="verb" style={`color: ${VERBS[verb].color}`}>
              {VERBS[verb].word}
            </span>
          {/key}
        </h1>
        <p class="text-dim mt-8 max-w-md text-base md:text-lg">
          Séries, films, animes, jeux, livres et albums. Loomkeep garde la trace
          de chaque séance — la date, l'épisode, la fois suivante — et te rend
          ta collection entière d'un seul coup d'œil.
        </p>
        <div class="mt-10 flex flex-wrap gap-3">
          <a
            href="/register"
            class="btn btn-primary btn-primary-cartouche btn-lg">
            Créer un compte
          </a>
          <a href="#programme" class="btn btn-ghost btn-lg"
            >Voir le programme</a>
        </div>
      </div>
    </section>

    <!-- ── Les salles + comparateur (prototypes 3 et 6, fusionnés) ────── -->
    <section id="programme" class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-20 md:py-28">
        <p class="timecode text-xs tracking-[0.22em] uppercase">Au programme</p>
        <h2
          class="font-display mt-5 max-w-2xl text-3xl font-extrabold tracking-tight md:text-5xl">
          Six salles, un seul billet.
        </h2>
        <p class="text-dim mt-6 max-w-2xl">
          Tu ouvres les salles qui te concernent. Celles que tu n'actives pas
          disparaissent de la navigation, de la recherche et des statistiques.
          Coche les tiennes ci-dessous : le reste de la page s'ajuste.
        </p>

        <ul class="border-border mt-12 border-t">
          {#each SALLES as salle (salle.id)}
            {@const on = picked.includes(salle.id)}
            <li class="border-border border-b">
              <button
                type="button"
                aria-pressed={on}
                onclick={() => toggle(salle.id)}
                class="group grid w-full items-baseline gap-x-6 gap-y-1 py-6 text-left transition-[padding,background] duration-200 hover:pl-3 md:grid-cols-[1.5rem_1fr_16rem_auto]"
                class:opacity-45={!on}>
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
                  class="font-display text-xl font-extrabold tracking-tight md:text-2xl">
                  {salle.label}
                </span>
                <span class="text-dim text-sm">{salle.detail}</span>
                <span
                  class="timecode text-[0.65rem] tracking-[0.16em] uppercase md:justify-self-end"
                  style={salle.color ? `color: ${salle.color}` : undefined}>
                  {salle.catalog}
                </span>
              </button>
            </li>
          {/each}
        </ul>

        <h3
          class="font-display mt-16 max-w-3xl text-2xl font-extrabold tracking-tight md:text-4xl">
          Combien d'applications te faut-il pour suivre tout ça&nbsp;?
        </h3>

        <div class="mt-8 grid gap-4 md:grid-cols-2">
          <div class="border-border rounded-2xl border p-6">
            <p class="timecode text-[0.65rem] tracking-[0.16em] uppercase">
              Avec les outils existants
            </p>
            {#if picked.length === 0}
              <p class="font-display mt-4 text-5xl font-extrabold">—</p>
              <p class="text-dim mt-3 text-sm">
                Coche au moins une salle au-dessus.
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
                    .map((s) => SALLES.find((x) => x.id === s)?.label)
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
              Une bibliothèque, une page de statistiques, un export. Le même
              compte pour toutes les salles que tu as ouvertes.
            </p>
            {#if pickedUnshipped.length > 0}
              <p class="text-dim mt-4 text-sm">
                <Icon
                  name="x"
                  class="text-danger mr-1 inline h-3.5 w-3.5 shrink-0" />
                {pickedUnshipped.map((s) => s.label).join(" et ")} : annoncés dans
                les réglages, pas encore développés.
              </p>
            {/if}
            <a href="/register" class="btn btn-primary btn-lg mt-6">
              Créer mon compte
            </a>
          </div>
        </div>

        <!-- Replaces the poster strip: the detail is one click away rather
             than always unfolded. -->
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
          {showDetail ? "Masquer" : "Voir"} le détail, service par service
        </button>

        {#if showDetail}
          <div class="mt-8">
            <p class="text-dim max-w-2xl text-sm">
              Ce que chaque service couvre, pour la sélection que tu viens de
              faire. Les couvertures partielles, les services auto-hébergés
              (icône bouclier) et TV Time (fermé) ne comptent pas dans le total
              ci-dessus — une inscription, un serveur à gérer et un service qui
              n'existe plus ne se comparent pas au même titre.
            </p>

            <ul class="border-border mt-6 border-t">
              {#each RIVALS as rival (rival.name)}
                {@const hits = rival.full.filter((s) => picked.includes(s))}
                {@const partialHit =
                  rival.partial && picked.includes(rival.partial.salle)}
                <li
                  class="border-border grid gap-x-6 gap-y-2 border-b py-4 md:grid-cols-[11rem_1fr_auto] md:items-center"
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
                        Fermé
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
                        {salle.label}{#if partial}&nbsp;· {rival.partial
                            ?.what}{/if}
                      </span>
                    {/each}
                  </span>
                  <span class="timecode text-[0.68rem] md:text-right">
                    {rival.price}
                  </span>
                  <span class="text-dim col-span-full text-sm">
                    {rival.note}
                  </span>
                </li>
              {/each}

              <li
                class="border-accent bg-accent/5 grid gap-x-6 gap-y-2 border-b py-4 md:grid-cols-[11rem_1fr_auto] md:items-center">
                <span
                  class="font-display text-accent flex items-center gap-2 font-bold">
                  Loomkeep
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
                      {salle.label}{#if !salle.shipped}&nbsp;· bientôt{/if}
                    </span>
                  {/each}
                </span>
                <span class="timecode text-[0.68rem] md:text-right">
                  gratuit, sans publicité
                </span>
                <span class="text-dim col-span-full text-sm">
                  Quatre salles ouvertes, deux annoncées. Sans abonnement, sans
                  serveur à gérer si tu ne veux pas — et si tu veux, l'icône
                  <Icon name="shield" class="mx-0.5 inline h-3 w-3" /> est aussi la
                  tienne.
                </span>
              </li>
            </ul>
          </div>
        {/if}
      </div>
    </section>

    <!-- ── Import (prototype 7, retitré) ──────────────────────────────── -->
    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-24">
        <div class="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2
              class="font-display text-2xl font-extrabold tracking-tight md:text-4xl">
              Tu viens d'ailleurs&nbsp;? Amène ton historique.
            </h2>
            <p class="text-dim mt-4">
              Rien de plus décourageant que de tout ressaisir. L'import reprend
              ta bibliothèque, collection par collection, en te montrant ce qui
              a été reconnu avant d'écrire quoi que ce soit.
            </p>
            <a href="/register" class="btn btn-primary mt-6">
              Importer ma bibliothèque
            </a>
            <p class="text-dim mt-6 text-sm">
              Ton service n'est pas là&nbsp;? Il est
              <a
                href={FEEDBACK_URL}
                target="_blank"
                rel="noopener noreferrer"
                class="link-accent">
                sur le tableau de suggestions
              </a>, et les votes décident de l'ordre.
            </p>
          </div>

          <div>
            <p class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
              Disponibles
            </p>
            <ul
              class="border-border mt-3 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2">
              {#each IMPORTS_DONE as source (source.name)}
                <li class="bg-surface px-5 py-4">
                  <p class="font-display flex items-center gap-2 font-bold">
                    <Icon name="check" class="text-success h-4 w-4 shrink-0" />
                    {source.name}
                  </p>
                  <p class="text-dim mt-0.5 text-sm">{source.what}</p>
                </li>
              {/each}
            </ul>

            <p class="timecode mt-8 text-[0.62rem] tracking-[0.18em] uppercase">
              Pas encore
            </p>
            <ul class="mt-3 flex flex-wrap gap-2">
              {#each IMPORTS_TODO as source (source.name)}
                <li
                  class="border-border text-dim rounded-lg border border-dashed px-3 py-1.5 text-sm"
                  title={source.what}>
                  {source.name}
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Le nom (prototype 3) ───────────────────────────────────────── -->
    <section class="border-border border-t">
      <div
        class="mx-auto grid max-w-5xl gap-12 px-5 py-20 md:py-28 lg:grid-cols-2">
        <div>
          <p class="timecode text-xs tracking-[0.22em] uppercase">
            À propos du nom
          </p>
          <h2
            class="font-display mt-5 text-2xl font-extrabold tracking-tight md:text-3xl">
            Un métier à tisser, et un endroit où l'on garde.
          </h2>
          <p class="text-dim mt-5">
            Six matières différentes, une seule étoffe. C'est ce que fait l'app
            : elle prend des choses qui n'ont rien à voir — vingt-deux minutes
            d'épisode, six cents pages de roman, quatre-vingts heures de jeu —
            et en fait une histoire lisible.
          </p>
          <p class="text-dim mt-4">
            Elle est développée par une seule personne, publiée en open source,
            sans publicité et sans investisseur à rembourser. Ton export est
            complet et gratuit, aujourd'hui comme le jour où tu voudras partir.
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost">
              Voir le code
            </a>
          </div>
        </div>

        <dl class="border-border flex flex-col gap-7 rounded-2xl border p-7">
          <div>
            <dt class="font-display text-accent text-2xl font-extrabold">
              loom
            </dt>
            <dd class="text-dim mt-2 text-sm">
              Le métier à tisser. Les fils, ce sont tes domaines ; la trame,
              c'est ton temps ; l'étoffe se fait pendant que tu regardes.
            </dd>
          </div>
          <div>
            <dt class="font-display text-accent text-2xl font-extrabold">
              keep
            </dt>
            <dd class="text-dim mt-2 text-sm">
              Le donjon d'un château : la partie qu'on garde en dernier. Tes
              données y restent — exportables, supprimables, jamais revendues.
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- ── CTA final (prototype 7, chiffre branché sur le comparateur) ── -->
    <section class="border-border border-t">
      <div class="mx-auto max-w-3xl px-5 py-24 text-center md:py-28">
        <h2
          class="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
          Ta collection mérite mieux que {tabsLabel}.
        </h2>
        <p class="text-dim mx-auto mt-6 max-w-xl">
          Gratuit, sans publicité, open source, développé par une seule
          personne. Tu peux tout exporter ou tout supprimer quand tu veux —
          c'est écrit avant l'inscription, pas après.
        </p>
        <div class="mt-9 flex flex-wrap justify-center gap-3">
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

  <SiteFooter />
</div>

<AppendixSections />

<style>
  .verb {
    display: inline-block;
    animation: cut 0.4s ease-out;
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
