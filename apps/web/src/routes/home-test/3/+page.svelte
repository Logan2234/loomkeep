<script lang="ts">
  // Prototype 3 — "Séance". Editorial and full-bleed: a poster wall lit by a
  // projector beam, a rotating verb in the headline, and the feature list set
  // as end credits. One demo only, and it is the real episode list.
  import Poster from "$lib/components/Poster.svelte";
  import { GITHUB_REPO_URL } from "$lib/constants/external-links";
  import LandingFooter from "../components/LandingFooter.svelte";
  import MockEpisodes from "../components/MockEpisodes.svelte";
  import { DOMAINS, LIBRARY } from "../components/mock-data";

  // The wall is the library itself: real covers from TMDB, AniList, Open
  // Library and Cover Art Archive, exactly as the app would load them.

  const VERBS = [
    { word: "vu.", color: "var(--stat-media)" },
    { word: "joué.", color: "var(--stat-games)" },
    { word: "lu.", color: "var(--stat-books)" },
    { word: "écouté.", color: "var(--stat-music)" },
  ];

  const CREDITS = [
    ["Épisodes", "suivis un par un"],
    ["Revisionnages", "comptés séparément, jamais écrasés"],
    ["Calendrier", "abonnable dans ton agenda, en iCal"],
    ["Notifications", "par le navigateur ou par email, ou aucune"],
    ["Imports", "TV Time · Trakt · Simkl · Steam · Goodreads · StoryGraph"],
    ["Statistiques", "par domaine et tous domaines confondus"],
    ["Possession", "blu-ray, dématérialisé, abonnement, emprunté"],
    ["Listes", "partageables, modifiables à plusieurs"],
    ["Profil", "privé par défaut, jusqu'au mode fantôme"],
    ["Objectif de lecture", "annuel, si tu aimes la pression"],
    ["Installation", "en application sur ton téléphone"],
    ["Données", "exportables, supprimables, jamais revendues"],
    ["Code", "AGPL-3.0, public"],
    ["Hébergement", "le nôtre, ou le tien avec Docker"],
    ["Publicité", "aucune"],
    ["Prix", "zéro"],
  ];

  let verb = $state(0);
  let beamX = $state(50);
  let beamY = $state(42);
  let reduced = $state(false);

  $effect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced = query.matches;
    if (query.matches) return;
    const id = setInterval(() => {
      verb = (verb + 1) % VERBS.length;
    }, 2200);
    return () => clearInterval(id);
  });

  let heroEl = $state<HTMLElement>();

  // Bound rather than declared inline: the beam is decoration, and an inline
  // pointermove handler would force an ARIA role onto a purely visual section.
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
  <title>Loomkeep — prototype 3 · Séance</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <header
    class="border-border bg-bg/85 sticky top-0 z-20 border-b backdrop-blur">
    <div
      class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
      <span class="font-display text-lg font-extrabold tracking-[0.02em]">
        LOOM<span class="text-accent">KEEP</span>
      </span>
      <div class="flex items-center gap-2">
        <a href="/login" class="btn btn-ghost">Se connecter</a>
        <a href="/register" class="btn btn-primary hidden sm:inline-flex"
          >Créer un compte</a>
      </div>
    </div>
  </header>

  <main class="flex-1">
    <!-- Hero: the wall of posters sits behind, the beam reveals it around the
         pointer. Pure decoration, hidden from assistive tech. -->
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
          Les catalogues sont interrogés en direct : rien n'est conservé tant
          que tu n'as pas ajouté une œuvre.
        </p>

        <ul class="border-border mt-12 border-t">
          {#each DOMAINS as domain, i (domain.label)}
            <li
              class="border-border grid gap-x-6 gap-y-1 border-b py-6 md:grid-cols-[5rem_1fr_16rem_auto] md:items-baseline"
              class:opacity-45={domain.color === null}>
              <span
                class="timecode text-xs"
                style={domain.color ? `color: ${domain.color}` : undefined}>
                SALLE {i + 1}
              </span>
              <span
                class="font-display text-xl font-extrabold tracking-tight md:text-2xl">
                {domain.label}
              </span>
              <span class="text-dim text-sm">{domain.detail}</span>
              <span
                class="timecode text-[0.65rem] tracking-[0.16em] uppercase md:justify-self-end">
                {domain.catalog}
              </span>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-20 md:py-28">
        <p class="timecode text-xs tracking-[0.22em] uppercase">La séance</p>
        <h2
          class="font-display mt-5 max-w-2xl text-3xl font-extrabold tracking-tight md:text-5xl">
          Un épisode, une ligne, une date.
        </h2>
        <p class="text-dim mt-6 max-w-2xl">
          Voici l'écran d'une série, tel qu'il est dans l'app. Coche un épisode
          : la progression de la saison suit. Et si tu reviens dessus dans trois
          ans, ce visionnage-ci ne sera pas effacé, il s'ajoutera.
        </p>
        <div class="mt-10 max-w-2xl">
          <MockEpisodes />
        </div>
      </div>
    </section>

    <section class="border-border bg-surface border-t">
      <div class="mx-auto max-w-3xl px-5 py-20 md:py-28">
        <p class="timecode text-center text-xs tracking-[0.22em] uppercase">
          Générique
        </p>
        <div
          class="credits mt-10 {reduced ? '' : 'credits-mask h-[24rem]'}"
          role="list">
          <div class={reduced ? "" : "roll"}>
            {#each reduced ? [0] : [0, 1] as pass (pass)}
              {#each CREDITS as [role, name] (role + pass)}
                <div
                  class="grid grid-cols-2 items-baseline gap-6 py-2.5"
                  role="listitem">
                  <span
                    class="timecode text-right text-[0.7rem] tracking-[0.16em] uppercase">
                    {role}
                  </span>
                  <span class="font-display text-sm font-bold md:text-base">
                    {name}
                  </span>
                </div>
              {/each}
            {/each}
          </div>
        </div>
        {#if !reduced}
          <p class="text-dim mt-8 text-center text-sm">
            Passe la souris dessus pour arrêter le défilement.
          </p>
        {/if}
      </div>
    </section>

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

    <section class="border-border border-t">
      <div class="mx-auto max-w-3xl px-5 py-24 text-center md:py-32">
        <p class="timecode text-xs tracking-[0.22em] uppercase">
          La séance commence
        </p>
        <h2
          class="font-display mx-auto mt-6 max-w-2xl text-4xl font-extrabold tracking-tight md:text-6xl">
          La première trace, c'est l'épisode de ce soir.
        </h2>
        <p class="text-dim mx-auto mt-6 max-w-md">
          Une adresse email suffit. Si tu arrives de TV Time, Trakt, Simkl,
          Steam, Goodreads ou StoryGraph, ton historique te rejoint en cinq
          minutes.
        </p>
        <div class="mt-10 flex flex-wrap justify-center gap-3">
          <a
            href="/register"
            class="btn btn-primary btn-primary-cartouche btn-lg">
            Entrer
          </a>
          <a href="/login" class="btn btn-ghost btn-lg">Se connecter</a>
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

  .credits-mask {
    overflow: hidden;
    mask-image: linear-gradient(
      180deg,
      transparent,
      #000 16%,
      #000 84%,
      transparent
    );
  }

  .roll {
    animation: roll 34s linear infinite;
  }

  .credits:hover .roll {
    animation-play-state: paused;
  }

  @keyframes roll {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(-50%);
    }
  }
</style>
