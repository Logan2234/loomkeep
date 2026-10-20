import { DOCS_URL } from "#lib/constants/external-links.js";
import { m } from "#lib/paraglide/messages.js";
import type { ImportSourceDescriptor } from "#lib/types/import-descriptor.js";
import {
  Domain,
  IMPORT_SOURCE_NAMES,
  type ImportSource,
} from "@loomkeep/shared";

export const IMPORTS_DEFINITION = {
  tvtime: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.tvtime,
    description: m.import_source_tvtime_description(),
    href: "/app/settings/import/tvtime",
    input: { type: "zip", accept: ".zip" },
    noun: { one: m.library_title_one(), many: m.library_title_many() },
    guide: `${DOCS_URL}/guide/imports/tv-time/`,
  },
  trakt: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.trakt,
    description: m.import_source_trakt_description(),
    href: "/app/settings/import/trakt",
    input: { type: "zip", accept: ".zip" },
    noun: { one: m.library_title_one(), many: m.library_title_many() },
    guide: `${DOCS_URL}/guide/imports/trakt/`,
  },
  letterboxd: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.letterboxd,
    description: m.import_source_letterboxd_description(),
    href: "/app/settings/import/letterboxd",
    input: { type: "zip", accept: ".zip" },
    noun: { one: m.library_title_one(), many: m.library_title_many() },
    newBadgeKey: "letterboxd",
    guide: `${DOCS_URL}/guide/imports/letterboxd/`,
  },
  imdb: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.imdb,
    description: m.import_source_imdb_description(),
    href: "/app/settings/import/imdb",
    // IMDb exports ratings, watchlist and each list as separate CSVs, taken
    // in one run. They have shipped as UTF-8 and as Windows-1252 depending on
    // the year, so the decoder sniffs rather than trusting one of them.
    input: {
      type: "csv",
      accept: ".csv,text/csv",
      textEncoding: "auto",
      multiple: true,
    },
    noun: { one: m.library_title_one(), many: m.library_title_many() },
    newBadgeKey: "imdb",
    guide: `${DOCS_URL}/guide/imports/imdb/`,
  },
  myanimelist: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.myanimelist,
    description: m.import_source_myanimelist_description(),
    href: "/app/settings/import/myanimelist",
    input: { type: "xml", accept: ".xml,application/xml,text/xml" },
    noun: { one: m.library_title_one(), many: m.library_title_many() },
    guide: `${DOCS_URL}/guide/imports/myanimelist/`,
  },
  anilist: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.anilist,
    description: m.import_source_anilist_description(),
    href: "/app/settings/import/anilist",
    input: {
      type: "username",
      placeholder: m.import_source_anilist_placeholder(),
    },
    noun: { one: m.library_title_one(), many: m.library_title_many() },
    newBadgeKey: "anilist-import",
    guide: `${DOCS_URL}/guide/imports/anilist/`,
  },
  simkl: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.simkl,
    description: m.import_source_simkl_description(),
    href: "/app/settings/import/simkl",
    input: { type: "oauth" },
    noun: { one: m.library_title_one(), many: m.library_title_many() },
  },
  kitsu: {
    comingSoon: true,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.kitsu,
    description: m.import_source_anime_description(),
  },
  steam: {
    comingSoon: false,
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
    comingSoon: false,
    domain: Domain.BOOKS,
    label: IMPORT_SOURCE_NAMES.storygraph,
    description: m.import_source_books_csv_description(),
    href: "/app/settings/import/storygraph",
    input: { type: "csv", accept: ".csv,text/csv" },
    noun: { one: m.common_book(), many: m.common_books() },
    guide: `${DOCS_URL}/guide/imports/storygraph/`,
  },
  goodreads: {
    comingSoon: false,
    domain: Domain.BOOKS,
    label: IMPORT_SOURCE_NAMES.goodreads,
    description: m.import_source_books_csv_description(),
    href: "/app/settings/import/goodreads",
    input: { type: "csv", accept: ".csv,text/csv" },
    noun: { one: m.common_book(), many: m.common_books() },
    guide: `${DOCS_URL}/guide/imports/goodreads/`,
  },
  babelio: {
    comingSoon: false,
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
    guide: `${DOCS_URL}/guide/imports/babelio/`,
  },
  librarything: {
    comingSoon: true,
    domain: Domain.BOOKS,
    label: IMPORT_SOURCE_NAMES.librarything,
    description: m.import_source_books_description(),
  },
  bookwyrm: {
    comingSoon: true,
    domain: Domain.BOOKS,
    label: IMPORT_SOURCE_NAMES.bookwyrm,
    description: m.import_source_books_description(),
  },
  opml: {
    comingSoon: true,
    domain: Domain.PODCASTS,
    label: IMPORT_SOURCE_NAMES.opml,
    description: m.import_source_opml_description(),
  },
  spotify: {
    comingSoon: true,
    domain: Domain.PODCASTS,
    label: IMPORT_SOURCE_NAMES.spotify,
    description: m.import_source_spotify_description(),
  },
  boardgamegeek: {
    comingSoon: true,
    domain: Domain.BOARDGAMES,
    label: IMPORT_SOURCE_NAMES.boardgamegeek,
    description: m.import_source_boardgamegeek_description(),
  },
} satisfies Record<ImportSource, ImportSourceDescriptor>;

export type AvailableImportSource = {
  [
    K in ImportSource
  ]: (typeof IMPORTS_DEFINITION)[K]["comingSoon"] extends false ? K : never;
}[ImportSource];
