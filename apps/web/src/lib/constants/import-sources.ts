import { DOCS_URL } from "#lib/constants/external-links.js";
import { m } from "#lib/paraglide/messages.js";
import type { ProviderBrandKey } from "#lib/provider-brands.js";
import type { ImportSourceDescriptor } from "#lib/types/import-descriptor.js";
import {
  Domain,
  IMPORT_SOURCE_NAMES,
  type ImportSource,
} from "@loomkeep/shared";

/** The brand mark of each import source that has one (the others fall back to their domain's icon). */
export const IMPORT_SOURCE_BRANDS: Partial<
  Record<ImportSource, ProviderBrandKey>
> = {
  tvtime: "tvtime",
  trakt: "trakt",
  letterboxd: "letterboxd",
  imdb: "imdb",
  myanimelist: "myanimelist",
  anilist: "anilist",
  simkl: "simkl",
  steam: "steam",
  storygraph: "storygraph",
  goodreads: "goodreads",
  babelio: "babelio",
};

export const IMPORTS_DEFINITION = {
  tvtime: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.tvtime,
    get description() {
      return m.import_source_tvtime_description();
    },
    href: "/app/settings/import/tvtime",
    input: { type: "zip", accept: ".zip" },
    noun: {
      get one() {
        return m.library_title_one();
      },
      get many() {
        return m.library_title_many();
      },
    },
    guide: `${DOCS_URL}/guide/imports/tv-time/`,
  },
  trakt: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.trakt,
    get description() {
      return m.import_source_trakt_description();
    },
    href: "/app/settings/import/trakt",
    input: { type: "zip", accept: ".zip" },
    noun: {
      get one() {
        return m.library_title_one();
      },
      get many() {
        return m.library_title_many();
      },
    },
    guide: `${DOCS_URL}/guide/imports/trakt/`,
  },
  letterboxd: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.letterboxd,
    get description() {
      return m.import_source_letterboxd_description();
    },
    href: "/app/settings/import/letterboxd",
    input: { type: "zip", accept: ".zip" },
    noun: {
      get one() {
        return m.library_title_one();
      },
      get many() {
        return m.library_title_many();
      },
    },
    newBadgeKey: "letterboxd",
    guide: `${DOCS_URL}/guide/imports/letterboxd/`,
  },
  imdb: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.imdb,
    get description() {
      return m.import_source_imdb_description();
    },
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
    noun: {
      get one() {
        return m.library_title_one();
      },
      get many() {
        return m.library_title_many();
      },
    },
    newBadgeKey: "imdb",
    guide: `${DOCS_URL}/guide/imports/imdb/`,
  },
  myanimelist: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.myanimelist,
    get description() {
      return m.import_source_myanimelist_description();
    },
    href: "/app/settings/import/myanimelist",
    input: { type: "xml", accept: ".xml,application/xml,text/xml" },
    noun: {
      get one() {
        return m.library_title_one();
      },
      get many() {
        return m.library_title_many();
      },
    },
    guide: `${DOCS_URL}/guide/imports/myanimelist/`,
  },
  anilist: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.anilist,
    get description() {
      return m.import_source_anilist_description();
    },
    href: "/app/settings/import/anilist",
    input: {
      type: "username",
      get placeholder() {
        return m.import_source_anilist_placeholder();
      },
    },
    noun: {
      get one() {
        return m.library_title_one();
      },
      get many() {
        return m.library_title_many();
      },
    },
    newBadgeKey: "anilist-import",
    guide: `${DOCS_URL}/guide/imports/anilist/`,
  },
  simkl: {
    comingSoon: false,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.simkl,
    get description() {
      return m.import_source_simkl_description();
    },
    href: "/app/settings/import/simkl",
    input: { type: "oauth" },
    noun: {
      get one() {
        return m.library_title_one();
      },
      get many() {
        return m.library_title_many();
      },
    },
  },
  kitsu: {
    comingSoon: true,
    domain: Domain.MEDIA,
    label: IMPORT_SOURCE_NAMES.kitsu,
    get description() {
      return m.import_source_anime_description();
    },
  },
  steam: {
    comingSoon: false,
    domain: Domain.GAMES,
    label: IMPORT_SOURCE_NAMES.steam,
    get description() {
      return m.import_source_steam_description();
    },
    href: "/app/settings/import/steam",
    input: {
      type: "steamId",
      get placeholder() {
        return m.import_source_steam_placeholder();
      },
    },
    noun: {
      get one() {
        return m.common_game();
      },
      get many() {
        return m.common_games();
      },
    },
    guide: `${DOCS_URL}/guide/imports/steam/`,
  },
  storygraph: {
    comingSoon: false,
    domain: Domain.BOOKS,
    label: IMPORT_SOURCE_NAMES.storygraph,
    get description() {
      return m.import_source_books_csv_description();
    },
    href: "/app/settings/import/storygraph",
    input: { type: "csv", accept: ".csv,text/csv" },
    noun: {
      get one() {
        return m.common_book();
      },
      get many() {
        return m.common_books();
      },
    },
    guide: `${DOCS_URL}/guide/imports/storygraph/`,
  },
  goodreads: {
    comingSoon: false,
    domain: Domain.BOOKS,
    label: IMPORT_SOURCE_NAMES.goodreads,
    get description() {
      return m.import_source_books_csv_description();
    },
    href: "/app/settings/import/goodreads",
    input: { type: "csv", accept: ".csv,text/csv" },
    noun: {
      get one() {
        return m.common_book();
      },
      get many() {
        return m.common_books();
      },
    },
    guide: `${DOCS_URL}/guide/imports/goodreads/`,
  },
  babelio: {
    comingSoon: false,
    domain: Domain.BOOKS,
    label: IMPORT_SOURCE_NAMES.babelio,
    get description() {
      return m.import_source_books_csv_description();
    },
    href: "/app/settings/import/babelio",
    input: {
      type: "csv",
      accept: ".csv,text/csv",
      textEncoding: "windows-1252",
    },
    noun: {
      get one() {
        return m.common_book();
      },
      get many() {
        return m.common_books();
      },
    },
    guide: `${DOCS_URL}/guide/imports/babelio/`,
  },
  librarything: {
    comingSoon: true,
    domain: Domain.BOOKS,
    label: IMPORT_SOURCE_NAMES.librarything,
    get description() {
      return m.import_source_books_description();
    },
  },
  bookwyrm: {
    comingSoon: true,
    domain: Domain.BOOKS,
    label: IMPORT_SOURCE_NAMES.bookwyrm,
    get description() {
      return m.import_source_books_description();
    },
  },
  opml: {
    comingSoon: true,
    domain: Domain.PODCASTS,
    label: IMPORT_SOURCE_NAMES.opml,
    get description() {
      return m.import_source_opml_description();
    },
  },
  spotify: {
    comingSoon: true,
    domain: Domain.PODCASTS,
    label: IMPORT_SOURCE_NAMES.spotify,
    get description() {
      return m.import_source_spotify_description();
    },
  },
  boardgamegeek: {
    comingSoon: true,
    domain: Domain.BOARDGAMES,
    label: IMPORT_SOURCE_NAMES.boardgamegeek,
    get description() {
      return m.import_source_boardgamegeek_description();
    },
  },
} satisfies Record<ImportSource, ImportSourceDescriptor>;

export type AvailableImportSource = {
  [
    K in ImportSource
  ]: (typeof IMPORTS_DEFINITION)[K]["comingSoon"] extends false ? K : never;
}[ImportSource];
