import { m } from "$lib/paraglide/messages";
import type { ImportSourceDescriptor } from "$lib/types/import-descriptor";
import { Domain, type ImportSource } from "@loomkeep/shared";

export const IMPORTS_DEFINITION: Record<ImportSource, ImportSourceDescriptor> =
  {
    tvtime: {
      domain: Domain.MEDIA,
      label: "TV Time",
      description: m.import_source_tvtime_description(),
      href: "/app/settings/import/tvtime",
      input: { type: "zip", accept: ".zip" },
      noun: { one: m.library_title_one(), many: m.library_title_many() },
    },
    trakt: {
      domain: Domain.MEDIA,
      label: "Trakt",
      description: m.import_source_trakt_description(),
      href: "/app/settings/import/trakt",
      input: { type: "zip", accept: ".zip" },
      noun: { one: m.library_title_one(), many: m.library_title_many() },
      newBadgeKey: "import-trakt",
    },
    letterboxd: {
      domain: Domain.MEDIA,
      label: "Letterboxd",
      description: m.import_source_letterboxd_description() as string,
    } as ImportSourceDescriptor,
    myanimelist: {
      domain: Domain.MEDIA,
      label: "MyAnimeList",
      description: m.import_source_anime_description() as string,
    } as ImportSourceDescriptor,
    simkl: {
      domain: Domain.MEDIA,
      label: "Simkl",
      description: m.import_source_simkl_description(),
      href: "/app/settings/import/simkl",
      input: { type: "oauth" },
      noun: { one: m.library_title_one(), many: m.library_title_many() },
      newBadgeKey: "import-simkl",
    },
    kitsu: {
      domain: Domain.MEDIA,
      label: "Kitsu",
      description: m.import_source_anime_description() as string,
    } as ImportSourceDescriptor,
    steam: {
      domain: Domain.GAMES,
      label: "Steam",
      description: m.import_source_steam_description(),
      href: "/app/settings/import/steam",
      input: {
        type: "steamId",
        placeholder: m.import_source_steam_placeholder(),
      },
      noun: { one: m.common_game(), many: m.common_games() },
    },
    backloggd: {
      domain: Domain.GAMES,
      label: "Backloggd",
      description: m.import_source_backloggd_description() as string,
    } as ImportSourceDescriptor,
    storygraph: {
      domain: Domain.BOOKS,
      label: "The StoryGraph",
      description: m.import_source_books_csv_description(),
      href: "/app/settings/import/storygraph",
      input: { type: "csv", accept: ".csv,text/csv" },
      noun: { one: m.common_book(), many: m.common_books() },
    },
    goodreads: {
      domain: Domain.BOOKS,
      label: "Goodreads",
      description: m.import_source_books_csv_description(),
      href: "/app/settings/import/goodreads",
      input: { type: "csv", accept: ".csv,text/csv" },
      noun: { one: m.common_book(), many: m.common_books() },
    },
    babelio: {
      domain: Domain.BOOKS,
      label: "Babelio",
      description: m.import_source_books_description() as string,
    } as ImportSourceDescriptor,
    librarything: {
      domain: Domain.BOOKS,
      label: "LibraryThing",
      description: m.import_source_books_description() as string,
    } as ImportSourceDescriptor,
    bookwyrm: {
      domain: Domain.BOOKS,
      label: "Bookwyrm",
      description: m.import_source_books_description() as string,
    } as ImportSourceDescriptor,
    opml: {
      domain: Domain.PODCASTS,
      label: "OPML",
      description: m.import_source_opml_description() as string,
    } as ImportSourceDescriptor,
    spotify: {
      domain: Domain.PODCASTS,
      label: "Spotify",
      description: m.import_source_spotify_description() as string,
    } as ImportSourceDescriptor,
    boardgamegeek: {
      domain: Domain.BOARDGAMES,
      label: "BoardGameGeek",
      description: m.import_source_boardgamegeek_description() as string,
    } as ImportSourceDescriptor,
  };
