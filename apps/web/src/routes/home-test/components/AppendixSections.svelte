<script lang="ts">
  // Everything the assembled page did NOT keep, re-rendered after the footer
  // and grouped by the prototype it came from, so nothing gets dropped by
  // accident. Sections already used in the final page are absent on purpose.
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import MockCalendar from "./MockCalendar.svelte";
  import MockEpisodes from "./MockEpisodes.svelte";
  import MockLibrary from "./MockLibrary.svelte";
  import MockStats from "./MockStats.svelte";
  import {
    DOMAIN_COLOR,
    DOMAIN_LABEL,
    DOMAINS,
    IMPORTS,
    LIBRARY,
  } from "./mock-data";

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

  const EDGES = [
    {
      title: "Un revisionnage ne remplace pas le premier",
      body: "Reprendre une série depuis le début ne remet pas ton compteur à zéro. Chaque passage est gardé avec sa date, et l'entrée passe à ×2.",
    },
    {
      title: "Les domaines que tu n'utilises pas disparaissent",
      body: "Tu ne suis pas d'albums ? Le domaine sort de la navigation, de la recherche et des statistiques.",
    },
    {
      title: "Ce que tu possèdes, à part de ce que tu as vu",
      body: "Blu-ray, achat dématérialisé, abonnement, emprunté. La plupart des trackers confondent « vu » et « possédé ».",
    },
    {
      title: "Les sorties dans ton vrai agenda",
      body: "Les prochains épisodes s'abonnent en iCal dans Google Agenda, Apple Calendrier ou Thunderbird.",
    },
    {
      title: "Ton export, sans condition",
      body: "CSV par domaine ou archive JSON complète, à tout moment. La porte de sortie est ouverte avant même que tu entres.",
    },
    {
      title: "Chez toi si tu veux",
      body: "Le code est public sous AGPL et la pile Docker est fournie. Si l'instance publique ferme, ta bibliothèque n'est pas otage.",
    },
  ];

  // Prototype 7's explorer, kept interactive: the idea is the click.
  const FACETS: Record<
    string,
    { feature: string; value: string; body: string }
  > = {
    Severance: {
      feature: "Suivi épisode par épisode",
      value: "4 / 10 épisodes · saison 2",
      body: "Tu coches, le statut et la progression se recalculent. Le prochain épisode part dans ton calendrier.",
    },
    "Everything Everywhere All at Once": {
      feature: "Les revisionnages sont gardés",
      value: "Vu 2 fois",
      body: "Un second visionnage n'écrase pas le premier : il s'ajoute avec sa date.",
    },
    Piranesi: {
      feature: "Progression en pages",
      value: "page 148 sur 240",
      body: "Un livre n'a pas d'épisodes : la progression se compte en pages, et alimente l'objectif annuel.",
    },
    "Blue Prince": {
      feature: "Temps de jeu et état",
      value: "En cours · 18 h",
      body: "À faire, en cours, terminé, abandonné. « À faire » sert aussi de liste d'envies.",
    },
    BRAT: {
      feature: "Volontairement binaire",
      value: "Écouté · ★ 8",
      body: "Un album se prend d'un bloc : il est écouté ou il ne l'est pas.",
    },
    "Dune, deuxième partie": {
      feature: "Ce que tu possèdes",
      value: "Blu-ray · vu",
      body: "Loomkeep sépare ce que tu as vu de ce que tu possèdes.",
    },
  };

  const FEATURED = Object.keys(FACETS);
  let selected = $state("Severance");
  const work = $derived(
    LIBRARY.find((w) => w.title === selected) ?? LIBRARY[0],
  );
  const facet = $derived(FACETS[selected] ?? FACETS.Severance);

  let importSource = $state(IMPORTS[0].name);
  const importDetail = $derived(
    IMPORTS.find((i) => i.name === importSource) ?? IMPORTS[0],
  );

  const GROUPS = [
    { n: 1, name: "Navette" },
    { n: 2, name: "Registre" },
    { n: 3, name: "Séance" },
    { n: 6, name: "Le comparateur" },
    { n: 7, name: "La collection" },
  ];
</script>

<div class="border-border bg-surface/40 border-t-4">
  <div class="mx-auto max-w-5xl px-5 py-14 md:px-8">
    <p class="timecode text-[0.65rem] tracking-[0.2em] uppercase">
      Hors page — annexe de revue
    </p>
    <h2
      class="font-display mt-4 text-2xl font-extrabold tracking-tight md:text-3xl">
      Les sections qui n'ont pas été reprises
    </h2>
    <p class="text-dim mt-4 max-w-2xl">
      Tout ce qui existait dans les prototypes 1, 2, 3, 6 et 7 et qui ne figure
      pas dans la page ci-dessus, groupé par origine. Les sections déjà
      intégrées sont absentes d'ici. Ce bloc est un outil de relecture : il n'a
      pas vocation à rester.
    </p>
    <ul class="mt-6 flex flex-wrap gap-2">
      {#each GROUPS as group (group.n)}
        <li>
          <a href="#reste-{group.n}" class="chip">
            {group.n} · {group.name}
          </a>
        </li>
      {/each}
    </ul>
  </div>
</div>

<!-- ══ Prototype 1 — Navette ═══════════════════════════════════════════ -->
<section id="reste-1" class="border-border border-t">
  <div class="mx-auto max-w-5xl px-5 py-10 md:px-8">
    <p class="timecode text-[0.65rem] tracking-[0.2em] uppercase">
      Prototype 1 · Navette
    </p>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">Son hero</h3>
    <div class="border-border mt-4 rounded-2xl border p-6">
      <p class="timecode text-xs tracking-[0.18em] uppercase">
        Suivi de collection · gratuit · open source
      </p>
      <p
        class="font-display mt-4 max-w-3xl text-3xl leading-[1.05] font-extrabold tracking-tight">
        Tout ce que tu regardes, joues, lis
        <span class="text-accent">et écoutes.</span>
      </p>
      <p class="text-dim mt-4 max-w-2xl">
        Une série se suit sur Trakt, un livre sur Goodreads, un jeu nulle part.
        Loomkeep les réunit dans une seule bibliothèque, avec le détail que
        chacun mérite : l'épisode pour les séries, la page pour les livres, les
        heures pour les jeux.
      </p>
    </div>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      La bibliothèque en pleine largeur
    </h3>
    <div class="mt-4">
      <MockLibrary
        count={6}
        chrome={true}
        gridClass="grid-cols-3 md:grid-cols-6" />
    </div>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « Aujourd'hui, ton suivi est dispersé »
    </h3>
    <div class="mt-4 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
      <ul class="flex flex-col gap-2">
        {#each [{ n: "Trakt", w: "séries et films" }, { n: "Letterboxd", w: "films" }, { n: "Goodreads", w: "livres" }, { n: "Un tableur", w: "tout le reste" }] as tool (tool.n)}
          <li
            class="border-border text-dim flex items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm">
            <span>{tool.n}</span>
            <span class="timecode text-xs">{tool.w}</span>
          </li>
        {/each}
      </ul>
      <span class="text-accent rotate-90 text-center text-2xl md:rotate-0"
        >→</span>
      <div class="border-accent bg-accent/5 rounded-xl border p-6">
        <p class="font-display text-lg font-bold">Loomkeep</p>
        <p class="text-dim mt-2 text-sm">
          Un compte, une bibliothèque, une page de statistiques. Les domaines
          gardent leurs règles propres, mais tout remonte au même endroit.
        </p>
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « Le geste, c'est cocher un épisode »
    </h3>
    <div class="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <MockEpisodes />
      <div class="flex flex-col gap-4">
        {#each [{ t: "Un revisionnage ne remplace pas le premier", b: "Chaque visionnage est enregistré séparément. Le compteur passe à ×2 et la première fois reste consultable, avec sa date." }, { t: "Le statut se déduit tout seul", b: "En cours, à jour, terminé : tu ne le saisis jamais à la main." }, { t: "Les épisodes viennent du catalogue", b: "Titres, saisons et dates de diffusion arrivent de TMDB et AniList." }] as card (card.t)}
          <div class="card p-5">
            <p class="font-display text-base font-bold">{card.t}</p>
            <p class="text-dim mt-2 text-sm">{card.b}</p>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « Six domaines, et tu choisis les tiens »
      <span class="text-dim text-sm font-normal">
        — recouverte par les salles sélectionnables
      </span>
    </h3>
    <ul class="border-border mt-4 border-t">
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

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « Ce qui sort cette semaine » et « Ton année en chiffres »
    </h3>
    <div class="mt-4 grid gap-10 lg:grid-cols-2">
      <MockCalendar />
      <MockStats />
    </div>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      Sa liste d'imports
      <span class="text-dim text-sm font-normal">
        — seul le titre a été repris
      </span>
    </h3>
    <ul
      class="border-border mt-4 grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2">
      {#each IMPORTS as source (source.name)}
        <li class="bg-surface flex items-baseline gap-4 px-5 py-4">
          <span class="font-display w-28 shrink-0 font-bold"
            >{source.name}</span>
          <span class="text-dim text-sm">{source.what}</span>
        </li>
      {/each}
    </ul>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-14 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « Gratuit, et sans le piège habituel »
    </h3>
    <div class="mt-4 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <p class="text-dim">
        Loomkeep est développé par une seule personne, sur son temps libre, et
        publié en open source. Il n'y a pas d'investisseur à rembourser, donc
        aucune raison de revendre ton historique. Si une offre payante arrive un
        jour, elle ajoutera des fonctions : elle ne fermera pas l'accès à ce que
        tu as déjà enregistré.
      </p>
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
    <p class="text-dim mt-6 text-sm">
      Son CTA final : « Commence par la série que tu regardes en ce moment. »
    </p>
  </div>
</section>

<!-- ══ Prototype 2 — Registre ══════════════════════════════════════════ -->
<section id="reste-2" class="border-border border-t">
  <div class="mx-auto max-w-5xl px-5 py-10 md:px-8">
    <p class="timecode text-[0.65rem] tracking-[0.2em] uppercase">
      Prototype 2 · Registre
    </p>
    <p class="text-dim mt-3 max-w-2xl text-sm">
      Son hero — l'app entière en onglets — n'est pas reproduit ici : c'est
      précisément la démonstration d'interface que tu as écartée. Il reste
      visible sur <a href="/home-test/2" class="link-accent">/home-test/2</a>.
    </p>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">Son bandeau de chiffres</h3>
    <div
      class="border-border mt-4 grid grid-cols-2 rounded-2xl border md:grid-cols-4">
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

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « Un épisode ne se suit pas comme un album »
    </h3>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card flex flex-col gap-3 p-4">
        <span class="timecode text-[0.62rem] tracking-[0.16em] uppercase">
          Films · séries · animes
        </span>
        <p class="font-display text-base font-bold">Une liste d'épisodes</p>
        <p class="text-dim text-sm">
          Le statut se déduit de ta progression. Tu ne le saisis jamais.
        </p>
      </div>
      <div class="card flex flex-col gap-3 p-4">
        <span class="timecode text-[0.62rem] tracking-[0.16em] uppercase">
          Jeux
        </span>
        <p class="font-display text-base font-bold">Quatre états</p>
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
        <span class="timecode text-[0.62rem] tracking-[0.16em] uppercase">
          Livres
        </span>
        <p class="font-display text-base font-bold">Une page courante</p>
        <div class="mt-auto flex items-center gap-2">
          <span class="timecode text-xs">p. 148</span>
          <span class="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full">
            <span
              class="block h-full rounded-full"
              style="width: 62%; background: var(--stat-books)"></span>
          </span>
          <span class="timecode text-xs">240</span>
        </div>
      </div>
      <div class="card flex flex-col gap-3 p-4">
        <span class="timecode text-[0.62rem] tracking-[0.16em] uppercase">
          Albums
        </span>
        <p class="font-display text-base font-bold">Écouté, ou pas</p>
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
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « Ce que Loomkeep ne fait pas »
    </h3>
    <div class="mt-4 grid gap-4 md:grid-cols-2">
      {#each NOT_DOING as item (item.title)}
        <div class="card flex gap-3 p-4">
          <Icon name="x" class="text-danger mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p class="font-display text-sm font-bold">{item.title}</p>
            <p class="text-dim mt-1 text-sm">{item.body}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-14 md:px-8">
    <h3 class="font-display text-xl font-bold">Son tableau « Données »</h3>
    <dl class="border-border mt-4 border-t">
      {#each [{ k: "Publicité et traceurs", v: "Aucun. Les statistiques de visite sont anonymes et hébergées par nos soins." }, { k: "Export", v: "Un CSV par domaine, ou une archive JSON complète du compte." }, { k: "Suppression du compte", v: "Immédiate, sans email pour te retenir." }, { k: "Code source", v: "Public, sous licence AGPL-3.0." }, { k: "Auto-hébergement", v: "Docker Compose. Il te faut une clé d'API TMDB, gratuite." }, { k: "Profil", v: "Privé par défaut, jusqu'au mode fantôme." }] as fact (fact.k)}
        <div
          class="border-border grid gap-1 border-b py-3 md:grid-cols-[14rem_1fr] md:gap-6">
          <dt class="text-sm font-semibold">{fact.k}</dt>
          <dd class="text-dim text-sm">{fact.v}</dd>
        </div>
      {/each}
    </dl>
    <p class="text-dim mt-6 text-sm">
      Son CTA final : « Crée le compte, ajoute une série, referme l'onglet. »
    </p>
  </div>
</section>

<!-- ══ Prototype 3 — Séance ════════════════════════════════════════════ -->
<section id="reste-3" class="border-border border-t">
  <div class="mx-auto max-w-5xl px-5 py-10 md:px-8">
    <p class="timecode text-[0.65rem] tracking-[0.2em] uppercase">
      Prototype 3 · Séance
    </p>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « La séance — Un épisode, une ligne, une date »
    </h3>
    <p class="text-dim mt-3 max-w-2xl">
      Voici l'écran d'une série, tel qu'il est dans l'app. Coche un épisode : la
      progression de la saison suit.
    </p>
    <div class="mt-6 max-w-2xl">
      <MockEpisodes />
    </div>
  </div>

  <div class="mx-auto max-w-3xl px-5 pb-14 md:px-8">
    <h3 class="font-display text-xl font-bold">Son générique de fin</h3>
    <div class="credits mt-6">
      <!-- Rendered twice so the -50% loop has no seam, as in prototype 3. -->
      <div class="roll">
        {#each [0, 1] as pass (pass)}
          {#each CREDITS as [role, name] (role + pass)}
            <div class="grid grid-cols-2 items-baseline gap-6 py-2.5">
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
    <p class="text-dim mt-6 text-sm">
      Son CTA final : « La première trace, c'est l'épisode de ce soir. »
    </p>
  </div>
</section>

<!-- ══ Prototype 6 — Le comparateur ════════════════════════════════════ -->
<section id="reste-6" class="border-border border-t">
  <div class="mx-auto max-w-5xl px-5 py-10 md:px-8">
    <p class="timecode text-[0.65rem] tracking-[0.2em] uppercase">
      Prototype 6 · Le comparateur
    </p>
    <p class="text-dim mt-3 max-w-2xl text-sm">
      Sa bande « Ta bibliothèque ressemblerait à ça » n'est pas reproduite : tu
      l'as explicitement remplacée par le dépliant du détail.
    </p>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « Et ton historique te suit » — le sélecteur d'import
    </h3>
    <div class="mt-4 flex flex-wrap gap-2">
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
    <div class="border-border mt-4 rounded-2xl border p-6">
      <p class="font-display text-lg font-bold">
        Depuis {importDetail.name}, Loomkeep reprend&nbsp;:
      </p>
      <p class="text-dim mt-2">{importDetail.what}</p>
    </div>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-14 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « Six différences que tu remarqueras à l'usage »
    </h3>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each EDGES as edge (edge.title)}
        <div class="card p-5">
          <p class="font-display text-base font-bold">{edge.title}</p>
          <p class="text-dim mt-2 text-sm">{edge.body}</p>
        </div>
      {/each}
    </div>
    <p class="text-dim mt-6 text-sm">
      Son CTA final : « Une application au lieu de trois. »
    </p>
  </div>
</section>

<!-- ══ Prototype 7 — La collection ═════════════════════════════════════ -->
<section id="reste-7" class="border-border border-t">
  <div class="mx-auto max-w-5xl px-5 py-10 md:px-8">
    <p class="timecode text-[0.65rem] tracking-[0.2em] uppercase">
      Prototype 7 · La collection
    </p>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-12 md:px-8">
    <h3 class="font-display text-xl font-bold">
      Son mur d'affiches cliquables
    </h3>
    <p class="text-dim mt-3 max-w-2xl">
      Chaque affiche ouvre une chose que Loomkeep garde et que les autres
      perdent. C'était le hero du prototype 7.
    </p>
    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div class="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {#each FEATURED as title (title)}
          {@const entry = LIBRARY.find((w) => w.title === title)}
          {#if entry}
            <button
              type="button"
              aria-pressed={selected === title}
              aria-label={title}
              onclick={() => (selected = title)}
              class="overflow-hidden rounded-lg border transition-[transform,border-color] hover:-translate-y-0.5 {selected ===
              title
                ? 'border-accent -translate-y-0.5'
                : 'border-border hover:border-accent'}">
              <Poster src={entry.cover} title={entry.title} />
            </button>
          {/if}
        {/each}
      </div>

      <div class="card p-5">
        <div class="flex gap-4">
          <div class="w-20 shrink-0 overflow-hidden rounded-lg">
            <Poster src={work.cover} title={work.title} />
          </div>
          <div class="min-w-0 flex-1">
            <span
              class="timecode text-[0.65rem] tracking-[0.16em] uppercase"
              style={`color: ${DOMAIN_COLOR[work.domain]}`}>
              {DOMAIN_LABEL[work.domain]} · {work.year}
            </span>
            <p class="font-display mt-1 text-xl leading-tight font-extrabold">
              {work.title}
            </p>
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
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-5xl px-5 pb-16 md:px-8">
    <h3 class="font-display text-xl font-bold">
      « Pourquoi pas Trakt, Letterboxd ou Goodreads ? »
    </h3>
    <p class="text-dim mt-3 max-w-2xl">
      Parce qu'il en faudrait trois, et qu'aucun des trois ne parle aux autres.
      Loomkeep couvre les six domaines d'un seul compte, sans publicité et sans
      revendre ce que tu regardes.
    </p>
    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

<style>
  .credits {
    height: 20rem;
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
