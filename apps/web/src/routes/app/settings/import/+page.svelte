<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { isDomainEnabled } from "$lib/domains";
  import { m } from "$lib/paraglide/messages.js";
  import { Domain } from "@loomkeep/shared";

  type ImportSource = {
    name: string;
    description: string;
    /** Present only for sources that actually import something today. */
    href?: string;
  };
  type ImportGroup = {
    domain: Domain;
    label: string;
    icon: "library" | "book" | "gamepad" | "podcast" | "boardgame";
    sources: ImportSource[];
  };

  // Disabled (no href) cards are a visible checklist of what's left to wire up,
  // not decoration — keep names to sources we'd actually build against.
  const GROUPS: ImportGroup[] = [
    {
      domain: Domain.MEDIA,
      label: "Vidéo",
      icon: "library",
      sources: [
        {
          name: "TV Time",
          description: "Films, séries et anime.",
          href: "/app/settings/import/tvtime",
        },
        { name: "Trakt", description: "Films et séries." },
        { name: "Letterboxd", description: "Films." },
        { name: "MyAnimeList", description: "Anime et manga." },
        { name: "Simkl", description: "Films, séries et anime." },
        { name: "Kitsu", description: "Anime et manga." },
      ],
    },
    {
      domain: Domain.BOOKS,
      label: "Livres",
      icon: "book",
      sources: [
        {
          name: "The StoryGraph",
          description: "Bibliothèque, statuts et notes (export CSV).",
          href: "/app/settings/import/storygraph",
        },
        {
          name: "Goodreads",
          description: "Bibliothèque, statuts et notes (export CSV).",
          href: "/app/settings/import/goodreads",
        },
        { name: "Babelio", description: "Bibliothèque et lectures." },
        { name: "LibraryThing", description: "Bibliothèque et lectures." },
        { name: "Bookwyrm", description: "Bibliothèque et lectures." },
      ],
    },
    {
      domain: Domain.GAMES,
      label: "Jeux",
      icon: "gamepad",
      sources: [
        {
          name: "Steam",
          description: "Bibliothèque et temps de jeu.",
          href: "/app/settings/import/steam",
        },
        { name: "Backloggd", description: "Backlog et jeux terminés." },
      ],
    },
    {
      domain: Domain.PODCASTS,
      label: "Podcasts",
      icon: "podcast",
      sources: [
        {
          name: "OPML",
          description:
            "Abonnements exportés depuis Apple Podcasts, Pocket Casts…",
        },
        { name: "Spotify", description: "Podcasts suivis." },
      ],
    },
    {
      domain: Domain.BOARDGAMES,
      label: "Jeux de société",
      icon: "boardgame",
      sources: [
        {
          name: "BoardGameGeek",
          description: "Collection et parties (export CSV).",
        },
      ],
    },
  ];
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <div class="mb-6 flex items-center gap-3">
    <a
      href="/app/settings"
      class="text-dim hover:text-fg"
      aria-label={m.common_back()}>
      <Icon name="chevron-left" class="h-5 w-5" />
    </a>
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Import
    </h1>
  </div>
  <p class="text-dim mb-8 max-w-xl text-sm">
    Récupère ton historique depuis une autre appli, par domaine.
  </p>

  <div class="flex flex-col gap-8">
    {#each GROUPS as group (group.domain)}
      {#if isDomainEnabled(group.domain)}
        <section>
          <p class="timecode mb-3 text-xs uppercase">{group.label}</p>
          <div class="flex flex-col gap-3">
            {#each group.sources as source (source.name)}
              {#if source.href}
                <a
                  href={source.href}
                  class="border-border bg-bg hover:border-accent hover:bg-surface-2 flex items-center gap-3 rounded-lg border p-4 transition-colors">
                  <Icon name={group.icon} class="text-accent h-6 w-6" />
                  <span class="flex-1">
                    <span class="block font-semibold">{source.name}</span>
                    <span class="text-dim text-sm">{source.description}</span>
                  </span>
                  <Icon name="chevron-right" class="text-dim h-5 w-5" />
                </a>
              {:else}
                <div
                  class="border-border bg-bg flex items-center gap-3 rounded-lg border p-4 opacity-60">
                  <Icon name={group.icon} class="text-dim h-6 w-6" />
                  <span class="flex-1">
                    <span class="block font-semibold">{source.name}</span>
                    <span class="text-dim text-sm">{source.description}</span>
                  </span>
                  <span
                    class="bg-surface-2 text-dim rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    Bientôt
                  </span>
                </div>
              {/if}
            {/each}
          </div>
        </section>
      {/if}
    {/each}
  </div>
</div>
