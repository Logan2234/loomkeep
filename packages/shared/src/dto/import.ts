import type { Domain, EntryStatus, MediaType } from "../enums";

// ============================================================================
// Generic, source-agnostic import model.
//
// Every import source runs through one async job framework: `analyze`
// parses the export and resolves it against the catalogue into a reviewable
// {@link ImportPlan} (writing nothing);
// `commit` writes the user's decisions and returns an {@link ImportReport}.
// Both phases run in the background as an {@link ImportJobDto} the client polls.
//
// The wizard UI and the job controller are fully generic over these shapes: a
// new source only supplies its own parse/resolve/write, never its own DTOs.
// ============================================================================

export type ImportSource =
  | "tvtime"
  | "trakt"
  | "letterboxd"
  | "myanimelist"
  | "simkl"
  | "kitsu"
  | "steam"
  | "backloggd"
  | "storygraph"
  | "goodreads"
  | "babelio"
  | "librarything"
  | "bookwyrm"
  | "opml"
  | "spotify"
  | "boardgamegeek";

/** How the raw export payload is carried in {@link ImportAnalyzeRequest.input}. */
export type ImportInputType =
  /** Raw CSV text (StoryGraph, Goodreads). */
  | "csv"
  /** A base64-encoded ZIP archive (TV Time). */
  | "zip"
  /** A Steam identifier / vanity name / profile URL. */
  | "steamId";

/** A catalogue title a source item resolved to (auto or via manual search). */
export interface ImportMatch {
  /** Catalogue source enum value (TMDB / ANILIST / GOOGLE_BOOKS / IGDB). */
  source: string;
  sourceId: string;
  /** Media only (MOVIE/SERIES/ANIME): TMDB namespaces ids by type. */
  type?: MediaType;
  title: string;
  year: number | null;
  coverUrl: string | null;
}

/** One reviewable item in the plan (a show, movie, book or game). */
export interface ImportPlanItem {
  /** Stable id carrying the user's decision from analyze → commit. */
  key: string;
  /** Catalogue title once matched; falls back to the source title. */
  title: string;
  /** Raw title from the export, shown when the match looks uncertain. */
  sourceTitle: string;
  /** Extra context under the title (rating, playtime, episodes…); null hides it. */
  subtitle: string | null;
  coverUrl: string | null;
  /** Auto-resolved match, or null when it needs a manual search. */
  match: ImportMatch | null;
  /** Default inclusion — true when confidently resolved and not already tracked. */
  include: boolean;
  /** Already in the user's library (the UI flags/skips it). */
  alreadyInLibrary: boolean;
  /**
   * Status pre-selected for the per-item control (the domain's own enum value,
   * e.g. "READ", "BACKLOG"). null when the source has no per-item status choice
   * (TV Time derives status from watch progress at commit).
   */
  defaultStatus: string | null;
  /** Resolution failed on an API error (rate limit/outage), not a real miss. */
  apiError?: boolean;
}

/** A named group the review renders as one (optionally collapsible) section. */
export interface ImportPlanGroup {
  /** Stable id (e.g. "READ", "seriesTracked"). */
  id: string;
  /** Section heading ("Lus", "Séries suivies"). */
  label: string;
  items: ImportPlanItem[];
}

/** The analysis result: everything the user reviews before writing. */
export interface ImportPlan {
  groups: ImportPlanGroup[];
  counts: {
    total: number;
    matched: number;
    /** Items with no automatic match (need a manual search). */
    unresolved: number;
    /** Items whose resolution failed on an API error (retry later). */
    apiErrors: number;
  };
  /** Which catalogue the manual-match search hits. */
  searchDomain: Domain;
}

/** One headline number in the completion report (rendered as a stat tile). */
export interface ImportReportTile {
  label: string;
  value: number;
  /** Secondary line under the number ("3 en watchlist"); null omits it. */
  sub: string | null;
}

/** Outcome of a committed import. */
export interface ImportReport {
  /** True when the run first wiped the user's library (destructive replace). */
  overwrite: boolean;
  tiles: ImportReportTile[];
}

/** An async import job (analyze or commit), polled by the client. */
export interface ImportJobDto {
  id: string;
  status: "running" | "completed" | "failed";
  /** Items processed so far / total to process. */
  progress: { done: number; total: number };
  /** Populated once an analysis job completes (the plan to review). */
  plan: ImportPlan | null;
  /** Populated once a commit job completes. */
  report: ImportReport | null;
  error: string | null;
}

/** Body of `POST /import/:source/analyze`. */
export interface ImportAnalyzeRequest {
  /**
   * The source payload, as a string interpreted per the source's declared
   * {@link ImportInputType}: CSV text, a Steam identifier, or a base64-encoded
   * ZIP. base64 keeps the JSON transport (no multipart, no new dependency).
   */
  input: string;
  /** Source-specific toggles (e.g. TV Time's `importMovies`). */
  options?: Record<string, boolean>;
}

/** A catalogue target chosen manually for an unresolved item, at commit time. */
export interface ImportCommitOverride {
  source: string;
  sourceId: string;
  type?: MediaType;
}

/** Body of `POST /import/:source/:jobId/commit` — the user's decisions. */
export interface ImportCommitRequest {
  /** Plan keys the user chose to import. */
  include: string[];
  /** Per-key status choice (domain enum value); for sources with a status control. */
  statuses?: Record<string, string>;
  /** Manual matches for items the analysis left unresolved, keyed by plan key. */
  overrides?: Record<string, ImportCommitOverride>;
  /** Wipe the domain's library before writing (destructive replace). */
  overwrite?: boolean;
}

/**
 * A source's UI-facing configuration — the single dictionary that parameterises
 * the generic wizard per source, so a new source is (mostly) a new entry here.
 * Backend resolution/write logic is the only per-source code that stays as an
 * `ImportSource` implementation.
 */
export interface ImportSourceDescriptor {
  /** Matches the backend source id and the `/import/:id` route segment. */
  id: string;
  /** Display name ("StoryGraph", "TV Time"). */
  label: string;
  domain: Domain;
  input: {
    type: ImportInputType;
    /** File `accept` attribute, for csv/zip inputs. */
    accept?: string;
  };
  /** Singular/plural noun for counts ("livre"/"livres", "jeu"/"jeux"). */
  noun: { one: string; many: string };
  /** Where the "voir ma bibliothèque" CTA links after a successful import. */
  libraryHref: string;
  /**
   * Source-specific boolean toggles offered on the input step, surfaced as
   * checkboxes and sent as {@link ImportAnalyzeRequest.options} (e.g. TV Time's
   * "Inclure les films").
   */
  options?: { key: string; label: string; default: boolean }[];
}

// ---------------------------------------------------------------------------
// TV Time export parse structure (source-specific; consumed only by the TV Time
// source's parser). Kept here so the parser and its tests share one shape.
// ---------------------------------------------------------------------------

/**
 * Raw CSV text extracted from a TV Time GDPR export, one field per relevant
 * file. The server builds this by unzipping the uploaded archive. Every field
 * is optional at this layer: the parser degrades gracefully when one is absent
 * (e.g. no rewatch file → no rewatches); required-file validation happens
 * upstream, right after unzipping.
 */
export interface TvTimeImportFilesDto {
  /** `tracking-prod-records-v2.csv` — one row per watched episode (source of truth). */
  episodesCsv?: string;
  /** `tracking-prod-records.csv` — movies (watched vs watchlist) via the `type` column. */
  recordsCsv?: string;
  /** `rewatched_episode.csv` — per-episode rewatch counter (`cpt`). */
  rewatchedCsv?: string;
  /** `user_tv_show_data.csv` — show names + TVDB id + episodes-seen count (watchlist detection). */
  showsCsv?: string;
}

/** Map a series' watched/total regular episodes to a library entry status. */
export function entryStatusFromProgress(
  watched: number,
  total: number,
): EntryStatus {
  if (watched === 0) return "PLANNED";
  if (total > 0 && watched >= total) return "COMPLETED";
  return "WATCHING";
}
