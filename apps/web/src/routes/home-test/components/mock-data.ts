// Sample data for the landing-page prototypes under /home-test.
//
// Cover URLs are the real ones, taken from the same providers the app itself
// uses: TMDB for films and series, AniList for anime, Open Library for books,
// Cover Art Archive for albums. Games are the exception — IGDB needs
// credentials we don't have here, so they fall back to Poster's gradient.
//
// Written by hand rather than fetched: these pages are public and must render
// the same for a signed-out visitor, with no API call on first paint.

export type MockDomain =
  "series" | "movies" | "anime" | "games" | "books" | "music";

/** Domain hue, matching the --stat-* tokens (films/series/anime share one). */
export const DOMAIN_COLOR: Record<MockDomain, string> = {
  series: "var(--stat-media)",
  movies: "var(--stat-media)",
  anime: "var(--stat-media)",
  games: "var(--stat-games)",
  books: "var(--stat-books)",
  music: "var(--stat-music)",
};

export const DOMAIN_LABEL: Record<MockDomain, string> = {
  series: "Série",
  movies: "Film",
  anime: "Anime",
  games: "Jeu",
  books: "Livre",
  music: "Album",
};

export interface MockEntry {
  title: string;
  domain: MockDomain;
  year: number;
  /** null falls back to Poster's deterministic gradient. */
  cover: string | null;
  /** Second line of the card: progress text, status or rating. */
  meta: string;
  /** 0-100; omit to render the status line instead of a progress bar. */
  progress?: number;
}

export const LIBRARY: MockEntry[] = [
  {
    title: "Severance",
    domain: "series",
    year: 2022,
    cover: "https://image.tmdb.org/t/p/w500/xmjW474DJ27bqTYNvS4MvraJgiQ.jpg",
    meta: "4 / 10 ép.",
    progress: 40,
  },
  {
    title: "Frieren",
    domain: "anime",
    year: 2023,
    cover:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
    meta: "18 / 28 ép.",
    progress: 64,
  },
  {
    title: "Piranesi",
    domain: "books",
    year: 2020,
    cover: "https://covers.openlibrary.org/b/id/10226290-L.jpg",
    meta: "p. 148 / 240",
    progress: 62,
  },
  {
    title: "Blue Prince",
    domain: "games",
    year: 2025,
    cover: null,
    meta: "En cours · 18 h",
  },
  {
    title: "Andor",
    domain: "series",
    year: 2022,
    cover: "https://image.tmdb.org/t/p/w500/wj0F4fU0jdsZI1cjiUSfeuE28y1.jpg",
    meta: "9 / 12 ép.",
    progress: 75,
  },
  {
    title: "BRAT",
    domain: "music",
    year: 2024,
    cover:
      "https://coverartarchive.org/release-group/e0fdb431-0109-420d-8a37-f99eaeb4d671/front-250",
    meta: "Écouté · ★ 8",
  },
  {
    title: "Dune, deuxième partie",
    domain: "movies",
    year: 2024,
    cover: "https://image.tmdb.org/t/p/w500/iRNbRAIGQQr5diGnjpwJFm0dgt4.jpg",
    meta: "Vu · ★ 9",
  },
  {
    title: "La Horde du Contrevent",
    domain: "books",
    year: 2004,
    cover: "https://covers.openlibrary.org/b/id/6670450-L.jpg",
    meta: "À lire",
  },
  {
    title: "The Bear",
    domain: "series",
    year: 2022,
    cover: "https://image.tmdb.org/t/p/w500/iaJfffjCqXATU5msr4PAgOWLMl4.jpg",
    meta: "12 / 28 ép.",
    progress: 43,
  },
  {
    title: "Chainsaw Man",
    domain: "anime",
    year: 2022,
    cover:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-DdP4vAdssLoz.png",
    meta: "7 / 12 ép.",
    progress: 58,
  },
  {
    title: "In Rainbows",
    domain: "music",
    year: 2007,
    cover:
      "https://coverartarchive.org/release-group/6e335887-60ba-38f0-95af-fae7774336bf/front-250",
    meta: "Écouté · ★ 10",
  },
  {
    title: "Hollow Knight: Silksong",
    domain: "games",
    year: 2025,
    cover: null,
    meta: "Terminé · ★ 9",
  },
  {
    title: "Arcane",
    domain: "series",
    year: 2021,
    cover: "https://image.tmdb.org/t/p/w500/ypS7R36Vjcn51zZsXsta5onnaCo.jpg",
    meta: "18 / 18 ép.",
    progress: 100,
  },
  {
    title: "Project Hail Mary",
    domain: "books",
    year: 2021,
    cover: "https://covers.openlibrary.org/b/id/11200092-L.jpg",
    meta: "Lu · ★ 9",
  },
  {
    title: "Everything Everywhere All at Once",
    domain: "movies",
    year: 2022,
    cover: "https://image.tmdb.org/t/p/w500/qHy7BlA1I3iUEIGp7atsMjSNJSK.jpg",
    meta: "Vu ×2 · ★ 10",
  },
  {
    title: "Cyberpunk: Edgerunners",
    domain: "anime",
    year: 2022,
    cover:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx120377-ayZPoxiWt4Li.jpg",
    meta: "10 / 10 ép.",
    progress: 100,
  },
  {
    title: "Shōgun",
    domain: "series",
    year: 2024,
    cover: "https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg",
    meta: "6 / 10 ép.",
    progress: 60,
  },
  {
    title: "Random Access Memories",
    domain: "music",
    year: 2013,
    cover:
      "https://coverartarchive.org/release-group/aa997ea0-2936-40bd-884d-3af8a0e064dc/front-250",
    meta: "Écouté · ★ 8",
  },
  {
    title: "Silo",
    domain: "series",
    year: 2023,
    cover: "https://image.tmdb.org/t/p/w500/dxktdopZCOlff10ocoEdn2TXBzl.jpg",
    meta: "3 / 10 ép.",
    progress: 30,
  },
  {
    title: "Vinland Saga",
    domain: "anime",
    year: 2019,
    cover:
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101348-2fhDFPCuMNiz.jpg",
    meta: "24 / 24 ép.",
    progress: 100,
  },
  {
    title: "Le Nom du vent",
    domain: "books",
    year: 2007,
    cover: "https://covers.openlibrary.org/b/id/11480483-L.jpg",
    meta: "p. 410 / 662",
    progress: 62,
  },
  {
    title: "Past Lives",
    domain: "movies",
    year: 2023,
    cover: "https://image.tmdb.org/t/p/w500/aFAANQwb3dYudPHXaQZX5NwVuTO.jpg",
    meta: "Vu · ★ 9",
  },
  {
    title: "Blonde",
    domain: "music",
    year: 2016,
    cover:
      "https://coverartarchive.org/release-group/0da340a0-6ad7-4fc2-a272-6f94393a7831/front-250",
    meta: "À écouter",
  },
  {
    title: "Outer Wilds",
    domain: "games",
    year: 2019,
    cover: null,
    meta: "Terminé · ★ 10",
  },
];

/** Quick lookup by title, for the components that only carry a name. */
export const COVER: Record<string, string | null> = Object.fromEntries(
  LIBRARY.map((entry) => [entry.title, entry.cover]),
);

export interface MockEpisode {
  number: number;
  title: string;
  /** Number of recorded viewings — 0 means never watched. */
  watchCount: number;
}

export const SEVERANCE_S2: MockEpisode[] = [
  { number: 1, title: "Hello, Ms. Cobel", watchCount: 1 },
  { number: 2, title: "Goodbye, Mrs. Selvig", watchCount: 2 },
  { number: 3, title: "Who Is Alive?", watchCount: 1 },
  { number: 4, title: "Woe's Hollow", watchCount: 1 },
  { number: 5, title: "Trojan's Horse", watchCount: 0 },
  { number: 6, title: "Attila", watchCount: 0 },
  { number: 7, title: "Chikhai Bardo", watchCount: 0 },
  { number: 8, title: "Sweet Vitriol", watchCount: 0 },
];

export interface MockCalendarDay {
  label: string;
  date: string;
  items: { title: string; code: string; episodeTitle?: string }[];
}

export const CALENDAR: MockCalendarDay[] = [
  {
    label: "Aujourd'hui",
    date: "mardi 19 août",
    items: [
      { title: "Severance", code: "S02E05", episodeTitle: "Trojan's Horse" },
    ],
  },
  {
    label: "Demain",
    date: "mercredi 20 août",
    items: [
      { title: "Frieren", code: "E19", episodeTitle: "L'épreuve du mage" },
      { title: "The Bear", code: "S04E01" },
    ],
  },
  {
    label: "Vendredi",
    date: "22 août",
    items: [
      { title: "Andor", code: "S02E10", episodeTitle: "Dernier épisode" },
    ],
  },
];

export const STAT_TILES = [
  { value: "41", unit: " j", label: "Temps cumulé", hint: "tous domaines" },
  { value: "1 284", label: "Épisodes vus", hint: "dont 96 revus" },
  { value: "27", label: "Œuvres terminées", hint: "cette année" },
  { value: "63", label: "Jours d'affilée", hint: "record : 91" },
];

export const STAT_BARS = [
  { label: "Séries", value: 712, display: "712 h", color: "var(--stat-media)" },
  { label: "Jeux", value: 419, display: "419 h", color: "var(--stat-games)" },
  { label: "Films", value: 248, display: "248 h", color: "var(--stat-media)" },
  {
    label: "Livres",
    value: 186,
    display: "31 lus",
    color: "var(--stat-books)",
  },
  {
    label: "Albums",
    value: 96,
    display: "96 écoutés",
    color: "var(--stat-music)",
  },
];

export const RESUME = [
  { title: "Severance", next: "S02E05", progress: 40 },
  { title: "Frieren", next: "E19", progress: 64 },
  { title: "Andor", next: "S02E10", progress: 75 },
  { title: "The Bear", next: "S04E01", progress: 43 },
  { title: "Shōgun", next: "S01E07", progress: 60 },
];

/** The six domains, in the fixed order used by the stats palette. */
export const DOMAINS = [
  {
    label: "Films, séries et animes",
    short: "Vidéo",
    icon: "tv",
    color: "var(--stat-media)",
    catalog: "TMDB · AniList",
    detail: "Suivi épisode par épisode, saisons et revisionnages.",
  },
  {
    label: "Jeux",
    short: "Jeux",
    icon: "gamepad",
    color: "var(--stat-games)",
    catalog: "IGDB",
    detail: "À faire, en cours, terminé ou abandonné, avec le temps de jeu.",
  },
  {
    label: "Livres",
    short: "Livres",
    icon: "book",
    color: "var(--stat-books)",
    catalog: "Open Library",
    detail: "Progression en pages et objectif de lecture annuel.",
  },
  {
    label: "Albums",
    short: "Musique",
    icon: "music",
    color: "var(--stat-music)",
    catalog: "MusicBrainz",
    detail: "À écouter ou écouté : un album se prend d'un bloc.",
  },
  {
    label: "Podcasts",
    short: "Podcasts",
    icon: "podcast",
    color: null,
    catalog: "Bientôt",
    detail: "Prévu, pas encore développé.",
  },
  {
    label: "Jeux de société",
    short: "Jeux de société",
    icon: "boardgame",
    color: null,
    catalog: "Bientôt",
    detail: "Prévu, pas encore développé.",
  },
] as const;

export const IMPORTS = [
  { name: "TV Time", what: "Séries et épisodes vus" },
  { name: "Trakt", what: "Historique, watchlist et notes" },
  { name: "Simkl", what: "Séries, films et animes" },
  { name: "Steam", what: "Bibliothèque et temps de jeu" },
  { name: "Goodreads", what: "Lectures, dates et notes (CSV)" },
  { name: "StoryGraph", what: "Lectures, dates et notes (CSV)" },
];
