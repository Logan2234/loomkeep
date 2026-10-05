import { DOCS_URL } from "#lib/constants/external-links.js";
import { m } from "#lib/paraglide/messages.js";
import type { ImportSourceDescriptor } from "#lib/types/import-descriptor.js";
import {
  Domain,
  IMPORT_SOURCE_NAMES,
  type ImportSource,
} from "@loomkeep/shared";

export const IMPORTS_DEFINITION: Record<ImportSource, ImportSourceDescriptor> =
  {
    tvtime: {
      domain: Domain.MEDIA,
      label: IMPORT_SOURCE_NAMES.tvtime,
      description: m.import_source_tvtime_description(),
      href: "/app/settings/import/tvtime",
      input: { type: "zip", accept: ".zip" },
      noun: { one: m.library_title_one(), many: m.library_title_many() },
      guide: `${DOCS_URL}/guide/imports/tv-time/`,
    },
    trakt: {
      domain: Domain.MEDIA,
      label: IMPORT_SOURCE_NAMES.trakt,
      description: m.import_source_trakt_description(),
      href: "/app/settings/import/trakt",
      input: { type: "zip", accept: ".zip" },
      noun: { one: m.library_title_one(), many: m.library_title_many() },
      guide: `${DOCS_URL}/guide/imports/trakt/`,
    },
    letterboxd: {
      domain: Domain.MEDIA,
      label: IMPORT_SOURCE_NAMES.letterboxd,
      description: m.import_source_letterboxd_description() as string,
    } as ImportSourceDescriptor,
    myanimelist: {
      domain: Domain.MEDIA,
      label: IMPORT_SOURCE_NAMES.myanimelist,
      description: m.import_source_myanimelist_description(),
      href: "/app/settings/import/myanimelist",
      input: { type: "xml", accept: ".xml,application/xml,text/xml" },
      noun: { one: m.library_title_one(), many: m.library_title_many() },
      newBadgeKey: "myanimelist",
      guide: `${DOCS_URL}/guide/imports/myanimelist/`,
    },
    simkl: {
      domain: Domain.MEDIA,
      label: IMPORT_SOURCE_NAMES.simkl,
      description: m.import_source_simkl_description(),
      href: "/app/settings/import/simkl",
      input: { type: "oauth" },
      noun: { one: m.library_title_one(), many: m.library_title_many() },
    },
    kitsu: {
      domain: Domain.MEDIA,
      label: IMPORT_SOURCE_NAMES.kitsu,
      description: m.import_source_anime_description() as string,
    } as ImportSourceDescriptor,
    steam: {
      domain: Domain.GAMES,
      label: IMPORT_SOURCE_NAMES.steam,
      description: m.import_source_steam_description(),
      href: "/app/settings/import/steam",
      input: {
        type: "steamId",
        placeholder: m.import_source_steam_placeholder(),
      },
      noun: { one: m.common_game(), many: m.common_games() },
      guide: `${DOCS_URL}/guide/imports/steam/`,
    },
    storygraph: {
      domain: Domain.BOOKS,
      label: IMPORT_SOURCE_NAMES.storygraph,
      description: m.import_source_books_csv_description(),
      href: "/app/settings/import/storygraph",
      input: { type: "csv", accept: ".csv,text/csv" },
      noun: { one: m.common_book(), many: m.common_books() },
      guide: `${DOCS_URL}/guide/imports/storygraph/`,
    },
    goodreads: {
      domain: Domain.BOOKS,
      label: IMPORT_SOURCE_NAMES.goodreads,
      description: m.import_source_books_csv_description(),
      href: "/app/settings/import/goodreads",
      input: { type: "csv", accept: ".csv,text/csv" },
      noun: { one: m.common_book(), many: m.common_books() },
      guide: `${DOCS_URL}/guide/imports/goodreads/`,
    },
    babelio: {
      domain: Domain.BOOKS,
      label: IMPORT_SOURCE_NAMES.babelio,
      description: m.import_source_books_csv_description(),
      href: "/app/settings/import/babelio",
      input: {
        type: "csv",
        accept: ".csv,text/csv",
        textEncoding: "windows-1252",
      },
      noun: { one: m.common_book(), many: m.common_books() },
      newBadgeKey: "babelio",
      guide: `${DOCS_URL}/guide/imports/babelio/`,
    },
    librarything: {
      domain: Domain.BOOKS,
      label: IMPORT_SOURCE_NAMES.librarything,
      description: m.import_source_books_description() as string,
    } as ImportSourceDescriptor,
    bookwyrm: {
      domain: Domain.BOOKS,
      label: IMPORT_SOURCE_NAMES.bookwyrm,
      description: m.import_source_books_description() as string,
    } as ImportSourceDescriptor,
    opml: {
      domain: Domain.PODCASTS,
      label: IMPORT_SOURCE_NAMES.opml,
      description: m.import_source_opml_description() as string,
    } as ImportSourceDescriptor,
    spotify: {
      domain: Domain.PODCASTS,
      label: IMPORT_SOURCE_NAMES.spotify,
      description: m.import_source_spotify_description() as string,
    } as ImportSourceDescriptor,
    boardgamegeek: {
      domain: Domain.BOARDGAMES,
      label: IMPORT_SOURCE_NAMES.boardgamegeek,
      description: m.import_source_boardgamegeek_description() as string,
    } as ImportSourceDescriptor,
  };
