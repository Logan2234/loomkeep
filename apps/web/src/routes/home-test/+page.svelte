<script lang="ts">
  // Index of the landing-page prototypes. Temporary, like the pages it lists.
  // Numbers 4 (Parcours) and 5 (La fiche) were dropped and are not reused, so
  // a number always refers to the same prototype in conversation.
  const PROTOTYPES = [
    {
      n: 1,
      name: "Navette",
      pitch:
        "Narratif. Six fils de couleur pour les domaines, et la bibliothèque en pleine largeur dès le premier écran.",
    },
    {
      n: 2,
      name: "Registre",
      pitch:
        "Dense, produit d'abord. L'app en onglets dans le hero, et une section sur ce que l'app ne fait pas.",
    },
    {
      n: 3,
      name: "Séance",
      pitch:
        "Éditorial. Mur d'affiches éclairé au projecteur, verbe qui défile, fonctions en générique de fin.",
    },
    {
      n: 6,
      name: "Le comparateur",
      pitch:
        "Interactif. Tu coches ce que tu suis, la page compte combien d'applications concurrentes il te faudrait.",
    },
    {
      n: 7,
      name: "La collection",
      pitch:
        "Interactif. Un mur d'affiches cliquables : chaque œuvre ouvre une chose que Loomkeep garde et que les autres perdent.",
    },
  ];
</script>

<svelte:head>
  <title>Prototypes de landing page</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-2xl px-5 py-16">
  <h1 class="font-display text-3xl font-extrabold tracking-tight">
    Prototypes de landing page
  </h1>
  <p class="text-dim mt-3 text-sm">
    Pages de travail : textes en dur (non traduits), données d'exemple, non
    indexées. Les jaquettes sont réelles, prises chez les mêmes fournisseurs que
    l'app — sauf les jeux, faute d'identifiants IGDB en local.
  </p>

  <ul class="mt-8 flex flex-col gap-3">
    {#each PROTOTYPES as proto (proto.n)}
      <li>
        <a
          href="/home-test/{proto.n}"
          class="card hover:border-accent block p-5 transition-[border-color]">
          <span class="flex items-baseline gap-3">
            <span class="timecode text-sm">{proto.n}</span>
            <span class="font-display text-lg font-bold">{proto.name}</span>
          </span>
          <span class="text-dim mt-2 block text-sm">{proto.pitch}</span>
        </a>
      </li>
    {/each}
  </ul>

  <p class="text-dim mt-10 text-xs">
    La page en production reste <a href="/" class="link-accent">/</a>. Rien n'a
    été modifié dessus.
  </p>
</div>
