<script lang="ts">
  // Prototype 2 — "Registre". Product first: the hero is the application
  // itself, in tabs, and the rest of the page is dense and factual, including
  // a section on what the app deliberately does not do.
  import Icon from "$lib/components/Icon.svelte";
  import { GITHUB_REPO_URL } from "$lib/constants/external-links";
  import type { IconName } from "$lib/types/icon-name";
  import LandingFooter from "../components/LandingFooter.svelte";
  import MockCalendar from "../components/MockCalendar.svelte";
  import MockLibrary from "../components/MockLibrary.svelte";
  import MockResume from "../components/MockResume.svelte";
  import MockStats from "../components/MockStats.svelte";
  import { DOMAINS, IMPORTS } from "../components/mock-data";

  type Screen = "home" | "library" | "calendar" | "stats";

  const SCREENS: { id: Screen; label: string; icon: IconName }[] = [
    { id: "home", label: "Accueil", icon: "home" },
    { id: "library", label: "Bibliothèque", icon: "library" },
    { id: "calendar", label: "Calendrier", icon: "calendar" },
    { id: "stats", label: "Statistiques", icon: "stats" },
  ];

  let screen = $state<Screen>("library");

  const NOT_DOING = [
    {
      title: "Aucune détection automatique",
      body: "Netflix, Prime et les autres ne laissent rien lire de l'extérieur. Tu coches toi-même : c'est deux secondes, et c'est la seule méthode qui ne mente pas.",
    },
    {
      title: "Pas d'application sur les stores",
      body: "Loomkeep s'installe depuis le navigateur et se comporte ensuite comme une app, hors ligne compris. Mais tu ne la trouveras pas sur l'App Store.",
    },
    {
      title: "Podcasts et jeux de société : plus tard",
      body: "Les deux domaines apparaissent dans les réglages, sans écran derrière pour l'instant. Ils arriveront quand ils seront prêts.",
    },
    {
      title: "Une communauté encore petite",
      body: "L'app est récente. Le côté social fonctionne, mais si tu cherches des milliers de critiques à lire, ce n'est pas encore ici.",
    },
  ];

  const FACTS = [
    {
      k: "Publicité et traceurs",
      v: "Aucun. Les statistiques de visite sont anonymes et hébergées par nos soins.",
    },
    {
      k: "Export",
      v: "Un CSV par domaine, ou une archive JSON complète du compte.",
    },
    { k: "Suppression du compte", v: "Immédiate, sans email pour te retenir." },
    { k: "Code source", v: "Public, sous licence AGPL-3.0." },
    {
      k: "Auto-hébergement",
      v: "Docker Compose. Il te faut une clé d'API TMDB, gratuite.",
    },
    { k: "Profil", v: "Privé par défaut, jusqu'au mode fantôme." },
  ];
</script>

<svelte:head>
  <title>Loomkeep — prototype 2 · Registre</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <header
    class="border-border bg-bg/90 sticky top-0 z-10 border-b backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center gap-7 px-5 py-3 md:px-8">
      <span class="font-display text-lg font-extrabold tracking-tight">
        LOOM<span class="text-accent">KEEP</span>
      </span>
      <nav class="text-dim mr-auto hidden gap-5 text-sm md:flex">
        <a href="#app" class="hover:text-fg">L'app</a>
        <a href="#domaines" class="hover:text-fg">Domaines</a>
        <a href="#import" class="hover:text-fg">Import</a>
        <a href="#limites" class="hover:text-fg">Limites</a>
        <a href="#donnees" class="hover:text-fg">Données</a>
      </nav>
      <div class="ml-auto flex items-center gap-2 md:ml-0">
        <a href="/login" class="btn btn-ghost">Se connecter</a>
        <a href="/register" class="btn btn-primary hidden sm:inline-flex"
          >Créer un compte</a>
      </div>
    </div>
  </header>

  <main class="flex-1">
    <section id="app" class="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <div
        class="grid gap-10 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] lg:items-center">
        <div>
          <p class="timecode text-xs tracking-[0.18em] uppercase">
            Suivi multimédia · gratuit · open source
          </p>
          <h1
            class="font-display mt-4 text-3xl leading-[1.06] font-extrabold tracking-tight md:text-5xl">
            L'app d'abord. Le discours après.
          </h1>
          <p class="text-dim mt-5 max-w-xl">
            Loomkeep suit tes séries, films, animes, jeux, livres et albums au
            même endroit. Voici les écrans que tu utiliseras tous les jours :
            change d'onglet, c'est la vraie interface.
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <a href="/register" class="btn btn-primary btn-lg">
              Créer un compte
            </a>
            <a href="#import" class="btn btn-ghost btn-lg">
              J'arrive de Trakt ou TV Time
            </a>
          </div>
          <p class="text-dim mt-4 text-sm">
            Une adresse email, pas de carte bancaire, pas d'essai qui expire.
          </p>
        </div>

        <!-- App frame: the icon rail on the left is the real navigation
             pattern, the tabs above swap between real screens. -->
        <div class="card overflow-hidden">
          <div
            class="border-border bg-bg flex items-center gap-1 overflow-x-auto border-b px-2 py-2">
            {#each SCREENS as item (item.id)}
              <button
                type="button"
                aria-pressed={screen === item.id}
                onclick={() => (screen = item.id)}
                class="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors {screen ===
                item.id
                  ? 'bg-surface-2 text-fg'
                  : 'text-dim hover:text-fg'}">
                <Icon name={item.icon} class="h-3.5 w-3.5" />
                {item.label}
              </button>
            {/each}
          </div>

          <div class="flex min-h-[26rem]">
            <div
              class="border-border bg-bg hidden w-11 shrink-0 flex-col items-center gap-1.5 border-r py-3 sm:flex"
              aria-hidden="true">
              {#each ["home", "library", "calendar", "stats", "user"] as name, i (name)}
                <span
                  class="grid h-7 w-7 place-items-center rounded-lg {i === 1
                    ? 'text-accent bg-accent/15'
                    : 'text-dim'}">
                  <Icon name={name as IconName} class="h-4 w-4" />
                </span>
              {/each}
            </div>

            <div class="min-w-0 flex-1 p-4">
              {#if screen === "home"}
                <MockResume />
              {:else if screen === "library"}
                <MockLibrary
                  count={8}
                  chrome={false}
                  gridClass="grid-cols-3 sm:grid-cols-4" />
              {:else if screen === "calendar"}
                <MockCalendar />
              {:else}
                <MockStats />
              {/if}
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="border-border bg-surface border-y">
      <div class="mx-auto max-w-6xl px-5 md:px-8">
        <div class="grid grid-cols-2 md:grid-cols-4">
          {#each [{ n: "6", t: "domaines, activables un par un" }, { n: "6", t: "imports depuis la concurrence" }, { n: "5", t: "catalogues interrogés en direct" }, { n: "0", t: "traceur publicitaire" }] as fact (fact.t)}
            <div
              class="border-border border-r border-b px-5 py-5 last:border-r-0 md:border-b-0">
              <p class="font-display text-3xl font-extrabold tabular-nums">
                {fact.n}
              </p>
              <p class="text-dim mt-1 text-sm">{fact.t}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <section id="domaines" class="border-border border-b">
      <div class="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-16">
        <h2 class="font-display text-xl font-bold tracking-tight md:text-2xl">
          Un épisode ne se suit pas comme un album
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          La plupart des trackers multi-domaines appliquent le même formulaire à
          tout. Ici, chaque domaine a le contrôle qui correspond à son objet —
          et celui que tu n'utilises pas, tu le désactives.
        </p>

        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="card flex flex-col gap-3 p-4">
            <span class="timecode text-[0.62rem] tracking-[0.16em] uppercase"
              >Films · séries · animes</span>
            <h3 class="font-display text-base font-bold">
              Une liste d'épisodes
            </h3>
            <p class="text-dim text-sm">
              Le statut se déduit de ta progression. Tu ne le saisis jamais.
            </p>
            <div
              class="border-border mt-auto overflow-hidden rounded-lg border">
              {#each [{ c: "S02E03", t: "Who Is Alive?", done: true }, { c: "S02E04", t: "Woe's Hollow", done: true }, { c: "S02E05", t: "Trojan's Horse", done: false }] as ep (ep.c)}
                <div
                  class="border-border flex items-center gap-2 border-b px-2.5 py-1.5 last:border-b-0">
                  <span class="timecode shrink-0 text-[0.68rem]">{ep.c}</span>
                  <span class="min-w-0 flex-1 truncate text-xs">{ep.t}</span>
                  {#if ep.done}
                    <Icon name="check" class="text-success h-3.5 w-3.5" />
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <div class="card flex flex-col gap-3 p-4">
            <span class="timecode text-[0.62rem] tracking-[0.16em] uppercase"
              >Jeux</span>
            <h3 class="font-display text-base font-bold">Quatre états</h3>
            <p class="text-dim text-sm">
              Un jeu n'a pas d'épisodes : c'est toi qui poses l'état. « À faire
              » sert aussi de liste d'envies.
            </p>
            <div
              class="border-border bg-surface-2 mt-auto grid grid-cols-4 gap-1 rounded-xl border p-1">
              {#each [{ l: "À faire", on: false }, { l: "En cours", on: true }, { l: "Fini", on: false }, { l: "Lâché", on: false }] as state (state.l)}
                <span
                  class="rounded-lg py-2 text-center text-[0.68rem] font-bold {state.on
                    ? 'bg-surface text-fg'
                    : 'text-dim'}">
                  {state.l}
                </span>
              {/each}
            </div>
          </div>

          <div class="card flex flex-col gap-3 p-4">
            <span class="timecode text-[0.62rem] tracking-[0.16em] uppercase"
              >Livres</span>
            <h3 class="font-display text-base font-bold">Une page courante</h3>
            <p class="text-dim text-sm">
              Et un objectif de lecture annuel, si tu aimes te mettre la
              pression.
            </p>
            <div class="mt-auto flex items-center gap-2">
              <span class="timecode text-xs">p. 148</span>
              <span
                class="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full">
                <span
                  class="block h-full rounded-full"
                  style="width: 62%; background: var(--stat-books)"></span>
              </span>
              <span class="timecode text-xs">240</span>
            </div>
          </div>

          <div class="card flex flex-col gap-3 p-4">
            <span class="timecode text-[0.62rem] tracking-[0.16em] uppercase"
              >Albums</span>
            <h3 class="font-display text-base font-bold">Écouté, ou pas</h3>
            <p class="text-dim text-sm">
              Volontairement binaire : un album s'écoute d'un bloc, il n'y a pas
              d'« en cours » crédible.
            </p>
            <div
              class="border-border bg-surface-2 mt-auto grid grid-cols-2 gap-1 rounded-xl border p-1">
              <span
                class="text-dim rounded-lg py-2 text-center text-[0.68rem] font-bold">
                À écouter
              </span>
              <span
                class="bg-surface text-fg rounded-lg py-2 text-center text-[0.68rem] font-bold">
                Écouté
              </span>
            </div>
          </div>
        </div>

        <ul class="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          {#each DOMAINS as domain (domain.label)}
            <li
              class="text-dim flex items-center gap-2 text-sm"
              class:opacity-50={domain.color === null}>
              <span
                class="h-2 w-2 rounded-full"
                style={`background: ${domain.color ?? "var(--border)"}`}></span>
              {domain.short}
              <span class="timecode text-[0.65rem]">{domain.catalog}</span>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <section id="import" class="border-border border-b">
      <div class="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-16">
        <h2 class="font-display text-xl font-bold tracking-tight md:text-2xl">
          Tu n'arrives pas de nulle part
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          L'import est un assistant : il te montre, collection par collection,
          ce qui a été reconnu et ce qui ne l'a pas été. Rien n'entre dans ta
          bibliothèque sans que tu l'aies vu passer.
        </p>
        <div class="mt-6 overflow-x-auto">
          <table class="w-full min-w-lg border-collapse text-sm">
            <thead>
              <tr class="border-border border-b">
                <th
                  class="timecode w-40 pr-4 pb-2 text-left text-[0.62rem] font-normal tracking-[0.16em] uppercase">
                  Source
                </th>
                <th
                  class="timecode pb-2 text-left text-[0.62rem] font-normal tracking-[0.16em] uppercase">
                  Ce qui est repris
                </th>
              </tr>
            </thead>
            <tbody>
              {#each IMPORTS as source (source.name)}
                <tr class="border-border border-b">
                  <td class="py-3 pr-4 font-semibold">{source.name}</td>
                  <td class="text-dim py-3">{source.what}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="limites" class="border-border border-b">
      <div class="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-16">
        <h2 class="font-display text-xl font-bold tracking-tight md:text-2xl">
          Ce que Loomkeep ne fait pas
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          Une page qui ne liste que des qualités ne t'apprend rien. Voici les
          manques, à jour.
        </p>
        <div class="mt-8 grid gap-4 md:grid-cols-2">
          {#each NOT_DOING as item (item.title)}
            <div class="card flex gap-3 p-4">
              <Icon name="x" class="text-danger mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <h3 class="font-display text-sm font-bold">{item.title}</h3>
                <p class="text-dim mt-1 text-sm">{item.body}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <section id="donnees" class="border-border border-b">
      <div class="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-16">
        <h2 class="font-display text-xl font-bold tracking-tight md:text-2xl">
          Gratuit, et sans le piège habituel
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          Loomkeep est développé par une seule personne et publié en open
          source. Si une offre payante arrive un jour, elle ajoutera des
          fonctions ; elle ne mettra pas tes données existantes derrière un mur,
          et l'export restera gratuit et complet.
        </p>
        <dl class="border-border mt-6 border-t">
          {#each FACTS as fact (fact.k)}
            <div
              class="border-border grid gap-1 border-b py-3 md:grid-cols-[14rem_1fr] md:gap-6">
              <dt class="text-sm font-semibold">{fact.k}</dt>
              <dd class="text-dim text-sm">{fact.v}</dd>
            </div>
          {/each}
        </dl>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
      <div
        class="border-border bg-surface grid gap-6 rounded-2xl border p-8 md:grid-cols-[1.4fr_auto] md:items-center md:p-10">
        <div>
          <h2 class="font-display text-2xl font-bold tracking-tight">
            Crée le compte, ajoute une série, referme l'onglet.
          </h2>
          <p class="text-dim mt-3 max-w-xl">
            Si tu n'y reviens pas dans la semaine, tu supprimes le compte en
            trois clics et il n'en reste rien. C'est le seul argument d'essai
            qu'on puisse tenir sans mentir.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <a href="/register" class="btn btn-primary btn-lg">Créer un compte</a>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost btn-lg">
            Voir le code
          </a>
        </div>
      </div>
    </section>
  </main>

  <LandingFooter />
</div>
