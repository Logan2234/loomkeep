<script lang="ts">
  // Prototype 1 — "Navette". The weave is the structural device: six coloured
  // threads (one per domain) run under the header and tint each section rule.
  // The hero shows the real library grid rather than an invented view.
  import Icon from "$lib/components/Icon.svelte";
  import { GITHUB_REPO_URL } from "$lib/constants/external-links";
  import LandingFooter from "../components/LandingFooter.svelte";
  import MockCalendar from "../components/MockCalendar.svelte";
  import MockEpisodes from "../components/MockEpisodes.svelte";
  import MockStats from "../components/MockStats.svelte";
  import MockLibrary from "../components/MockLibrary.svelte";
  import { DOMAINS, IMPORTS } from "../components/mock-data";

  const THREADS = [
    "var(--stat-media)",
    "var(--stat-games)",
    "var(--stat-books)",
    "var(--stat-music)",
    "var(--border)",
    "var(--border)",
  ];
</script>

<svelte:head>
  <title>Loomkeep — prototype 1 · Navette</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <header
    class="border-border bg-bg/85 sticky top-0 z-10 border-b backdrop-blur">
    <div
      class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
      <span class="font-display text-xl font-extrabold tracking-tight">
        LOOM<span class="text-accent">KEEP</span>
      </span>
      <div class="flex items-center gap-2">
        <a href="/login" class="btn btn-ghost">Se connecter</a>
        <a href="/register" class="btn btn-primary hidden sm:inline-flex"
          >Créer un compte</a>
      </div>
    </div>
    <!-- The six threads: one per domain, greyed for the two still to come. -->
    <div class="flex h-[3px]" aria-hidden="true">
      {#each THREADS as thread, i (i)}
        <span class="flex-1" style={`background: ${thread}`}></span>
      {/each}
    </div>
  </header>

  <main class="flex-1">
    <section class="mx-auto max-w-5xl px-5 pt-14 pb-10 md:pt-20">
      <p class="timecode text-xs tracking-[0.18em] uppercase">
        Suivi de collection · gratuit · open source
      </p>
      <h1
        class="font-display mt-5 max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight md:text-6xl">
        Tout ce que tu regardes, joues, lis
        <span class="text-accent">et écoutes.</span>
      </h1>
      <p class="text-dim mt-6 max-w-2xl text-base md:text-lg">
        Une série se suit sur Trakt, un livre sur Goodreads, un jeu nulle part.
        Loomkeep les réunit dans une seule bibliothèque, avec le détail que
        chacun mérite : l'épisode pour les séries, la page pour les livres, les
        heures pour les jeux.
      </p>

      <div class="mt-9 flex flex-wrap items-center gap-3">
        <a
          href="/register"
          class="btn btn-primary btn-primary-cartouche btn-lg">
          Créer mon compte
        </a>
        <a href="#suivi" class="btn btn-ghost btn-lg">Voir l'app</a>
      </div>
      <p class="text-dim mt-5 text-sm">
        Sans publicité et sans revente de données. Tu peux tout exporter, ou
        tout supprimer, quand tu veux.
      </p>
    </section>

    <!-- Real library screen, cropped by a fade so it reads as a window on the
         app rather than a framed screenshot. -->
    <section class="relative">
      <div class="mx-auto max-w-6xl px-5 md:px-8">
        <MockLibrary count={12} chrome={true} />
      </div>
      <div
        class="from-bg pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t to-transparent">
      </div>
    </section>

    <section class="border-border mt-16 border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Aujourd'hui, ton suivi est dispersé.
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          Chaque outil fait bien une seule chose et refuse de faire les autres.
          Résultat : aucun ne peut te dire ce que tu as terminé cette année,
          tous formats confondus.
        </p>

        <div class="mt-8 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <ul class="flex flex-col gap-2">
            {#each [{ n: "Trakt", w: "séries et films" }, { n: "Letterboxd", w: "films" }, { n: "Goodreads", w: "livres" }, { n: "Un tableur", w: "tout le reste" }] as tool (tool.n)}
              <li
                class="border-border text-dim flex items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm">
                <span>{tool.n}</span>
                <span class="timecode text-xs">{tool.w}</span>
              </li>
            {/each}
          </ul>

          <span
            class="text-accent rotate-90 text-center text-2xl md:rotate-0"
            aria-hidden="true">
            →
          </span>

          <div class="border-accent bg-accent/5 rounded-xl border p-6">
            <h3 class="font-display text-lg font-bold">Loomkeep</h3>
            <p class="text-dim mt-2 text-sm">
              Un compte, une bibliothèque, une page de statistiques. Les
              domaines gardent leurs règles propres, mais tout remonte au même
              endroit.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section id="suivi" class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Le geste, c'est cocher un épisode.
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          La progression, le statut de la série et le prochain épisode dans ton
          calendrier suivent tout seuls. Voici l'écran tel quel — tu peux
          cliquer.
        </p>

        <div
          class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <MockEpisodes />

          <div class="flex flex-col gap-4">
            <div class="card p-5">
              <h3 class="font-display text-base font-bold">
                Un revisionnage ne remplace pas le premier
              </h3>
              <p class="text-dim mt-2 text-sm">
                Chaque visionnage est enregistré séparément. Quand tu reprends
                une série depuis le début, le compteur passe à ×2 et la première
                fois reste consultable, avec sa date.
              </p>
            </div>
            <div class="card p-5">
              <h3 class="font-display text-base font-bold">
                Le statut se déduit tout seul
              </h3>
              <p class="text-dim mt-2 text-sm">
                En cours, à jour, terminé : tu ne le saisis jamais à la main. Il
                se calcule à partir de ce que tu as vu et de la diffusion en
                cours.
              </p>
            </div>
            <div class="card p-5">
              <h3 class="font-display text-base font-bold">
                Les épisodes viennent du catalogue
              </h3>
              <p class="text-dim mt-2 text-sm">
                Titres, saisons et dates de diffusion sont récupérés chez TMDB
                et AniList. Rien n'est enregistré chez nous tant que tu n'as pas
                ajouté l'œuvre.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Six domaines, et tu choisis les tiens
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          Si tu ne suis pas d'albums, tu désactives le domaine : il disparaît de
          la navigation, de la recherche et des statistiques.
        </p>

        <ul class="border-border mt-8 border-t">
          {#each DOMAINS as domain (domain.label)}
            <li
              class="border-border grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 border-b py-4 md:grid-cols-[auto_14rem_1fr_auto] md:items-center"
              class:opacity-50={domain.color === null}>
              <span
                class="grid h-9 w-9 place-items-center rounded-lg"
                style={domain.color
                  ? `color: ${domain.color}; background: color-mix(in srgb, ${domain.color} 14%, transparent)`
                  : undefined}>
                <Icon name={domain.icon} class="h-5 w-5" />
              </span>
              <span class="font-display font-bold">{domain.label}</span>
              <span class="text-dim col-start-2 text-sm md:col-start-3">
                {domain.detail}
              </span>
              <span
                class="timecode col-start-2 text-[0.65rem] tracking-[0.12em] uppercase md:col-start-4">
                {domain.catalog}
              </span>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <div class="grid gap-12 lg:grid-cols-2">
          <div>
            <h2
              class="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Ce qui sort cette semaine
            </h2>
            <p class="text-dim mt-3">
              Les prochains épisodes de tes séries en cours. La même liste
              s'ajoute à ton agenda habituel par abonnement iCal, et se met à
              jour toute seule.
            </p>
            <div class="mt-6">
              <MockCalendar />
            </div>
          </div>

          <div>
            <h2
              class="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Ton année, en chiffres
            </h2>
            <p class="text-dim mt-3">
              Temps passé, œuvres terminées, répartition par domaine, jours
              d'affilée. Par domaine, ou tous domaines confondus.
            </p>
            <div class="mt-6">
              <MockStats />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-5xl px-5 py-14 md:py-20">
        <h2 class="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Tu viens d'ailleurs ? Amène ton historique.
        </h2>
        <p class="text-dim mt-3 max-w-2xl">
          L'import se fait collection par collection : tu vois ce qui a été
          reconnu, ce qui ne l'a pas été, et tu valides avant que quoi que ce
          soit entre dans ta bibliothèque.
        </p>

        <ul
          class="border-border mt-8 grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2">
          {#each IMPORTS as source (source.name)}
            <li class="bg-surface flex items-baseline gap-4 px-5 py-4">
              <span class="font-display w-28 shrink-0 font-bold">
                {source.name}
              </span>
              <span class="text-dim text-sm">{source.what}</span>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <section class="border-border border-t">
      <div
        class="mx-auto grid max-w-5xl gap-10 px-5 py-14 md:py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2
            class="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Gratuit, et sans le piège habituel
          </h2>
          <p class="text-dim mt-4">
            Loomkeep est développé par une seule personne, sur son temps libre,
            et publié en open source. Il n'y a pas d'investisseur à rembourser,
            donc aucune raison de revendre ton historique. Si une offre payante
            arrive un jour, elle ajoutera des fonctions : elle ne fermera pas
            l'accès à ce que tu as déjà enregistré.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost">
              Voir le code
            </a>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost">
              Héberger toi-même
            </a>
          </div>
        </div>

        <ul class="border-border overflow-hidden rounded-xl border">
          {#each [{ k: "Licence", v: "AGPL-3.0" }, { k: "Publicité et traceurs", v: "aucun" }, { k: "Export de tes données", v: "CSV et JSON" }, { k: "Suppression du compte", v: "immédiate" }, { k: "Sur mobile", v: "installable" }, { k: "Auto-hébergement", v: "Docker" }] as fact (fact.k)}
            <li
              class="border-border flex items-center justify-between gap-4 border-b px-5 py-3 text-sm last:border-b-0">
              <span class="text-dim">{fact.k}</span>
              <span class="timecode text-xs">{fact.v}</span>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <section class="border-border border-t">
      <div class="mx-auto max-w-3xl px-5 py-20 text-center md:py-24">
        <h2
          class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Commence par la série que tu regardes en ce moment.
        </h2>
        <p class="text-dim mx-auto mt-5 max-w-xl">
          Une adresse email suffit. Si tu arrives de TV Time, Trakt ou Steam,
          l'import prend cinq minutes.
        </p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/register"
            class="btn btn-primary btn-primary-cartouche btn-lg">
            Créer mon compte
          </a>
          <a href="/login" class="btn btn-ghost btn-lg">Se connecter</a>
        </div>
      </div>
    </section>
  </main>

  <LandingFooter />
</div>
