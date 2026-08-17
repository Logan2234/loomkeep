import type { ImportSourceDescriptor } from "$lib/types/import-descriptor";
import { Domain, type ImportSource } from "@loomkeep/shared";

// Disabled (no href) cards are a visible checklist of what's left to wire up,
// not decoration — keep names to sources we'd actually build against.
export const IMPORTS_DEFINITION: Record<ImportSource, ImportSourceDescriptor> =
  {
    tvtime: {
      domain: Domain.MEDIA,
      label: "TV Time",
      description: "Films, séries et anime.",
      href: "/app/settings/import/tvtime",
      input: { type: "zip", accept: ".zip" },
      noun: { one: "titre", many: "titres" },
    },
    trakt: {
      domain: Domain.MEDIA,
      label: "Trakt",
      description: "Films et séries (historique et watchlist, export .zip).",
      href: "/app/settings/import/trakt",
      input: { type: "zip", accept: ".zip" },
      noun: { one: "titre", many: "titres" },
      newBadgeKey: "import-trakt",
    },
    letterboxd: {
      domain: Domain.MEDIA,
      label: "Letterboxd",
      description: "Films.",
    } as ImportSourceDescriptor,
    myanimelist: {
      domain: Domain.MEDIA,
      label: "MyAnimeList",
      description: "Anime et manga.",
    } as ImportSourceDescriptor,
    simkl: {
      domain: Domain.MEDIA,
      label: "Simkl",
      description: "Films, séries et anime (via connexion à ton compte).",
      href: "/app/settings/import/simkl",
      input: { type: "oauth" },
      noun: { one: "titre", many: "titres" },
      newBadgeKey: "import-simkl",
    },
    kitsu: {
      domain: Domain.MEDIA,
      label: "Kitsu",
      description: "Anime et manga.",
    } as ImportSourceDescriptor,
    steam: {
      domain: Domain.GAMES,
      label: "Steam",
      description: "Bibliothèque et temps de jeu.",
      href: "/app/settings/import/steam",
      input: {
        type: "steamId",
        placeholder: "76561198… ou steamcommunity.com/id/pseudo",
      },
      noun: { one: "jeu", many: "jeux" },
    },
    backloggd: {
      domain: Domain.GAMES,
      label: "Backloggd",
      description: "Backlog et jeux terminés.",
    } as ImportSourceDescriptor,
    storygraph: {
      domain: Domain.BOOKS,
      label: "The StoryGraph",
      description: "Bibliothèque, statuts et notes (export CSV).",
      href: "/app/settings/import/storygraph",
      input: { type: "csv", accept: ".csv,text/csv" },
      noun: { one: "livre", many: "livres" },
    },
    goodreads: {
      domain: Domain.BOOKS,
      label: "Goodreads",
      description: "Bibliothèque, statuts et notes (export CSV).",
      href: "/app/settings/import/goodreads",
      input: { type: "csv", accept: ".csv,text/csv" },
      noun: { one: "livre", many: "livres" },
    },
    babelio: {
      domain: Domain.BOOKS,
      label: "Babelio",
      description: "Bibliothèque et lectures.",
    } as ImportSourceDescriptor,
    librarything: {
      domain: Domain.BOOKS,
      label: "LibraryThing",
      description: "Bibliothèque et lectures.",
    } as ImportSourceDescriptor,
    bookwyrm: {
      domain: Domain.BOOKS,
      label: "Bookwyrm",
      description: "Bibliothèque et lectures.",
    } as ImportSourceDescriptor,
    opml: {
      domain: Domain.PODCASTS,
      label: "OPML",
      description: "Abonnements exportés depuis Apple Podcasts, Pocket Casts…",
    } as ImportSourceDescriptor,
    spotify: {
      domain: Domain.PODCASTS,
      label: "Spotify",
      description: "Podcasts suivis.",
    } as ImportSourceDescriptor,
    boardgamegeek: {
      domain: Domain.BOARDGAMES,
      label: "BoardGameGeek",
      description: "Collection et parties (export CSV).",
    } as ImportSourceDescriptor,
  };
