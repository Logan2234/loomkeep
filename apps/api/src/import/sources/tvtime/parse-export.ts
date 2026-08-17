import type { TvTimeImportFilesDto } from "@loomkeep/shared";
import { parseCsv } from "../../csv";

/** One distinct watched episode of a show, with its rewatch count folded in. */
interface ParsedWatchedEpisode {
  season: number;
  episode: number;
  /** TheTVDB episode id (used to attach rewatch counts). */
  tvdbEpisodeId: string;
  /** Approximate — TV Time stores record-creation time, not real watch time. */
  watchedAt: Date | null;
  /** Base watch + rewatches. Always >= 1. */
  totalWatches: number;
}

export interface ParsedShow {
  /** TheTVDB series id. */
  tvdbId: string;
  name: string;
  /** Distinct watched episodes; empty means the show is only on the watchlist. */
  episodes: ParsedWatchedEpisode[];
}

export interface ParsedMovie {
  title: string;
  year: number | null;
  /** true → watched (COMPLETED); false → watchlist (PLANNED). */
  watched: boolean;
  /** Earliest watch. Approximate — TV Time stores record-creation time, not real watch time. */
  watchedAt: Date | null;
  /** Extra watch dates beyond `watchedAt` (rewatches), oldest first. */
  rewatchedAt: Date[];
}

export interface ParsedExport {
  shows: ParsedShow[];
  movies: ParsedMovie[];
}

/**
 * Turn the raw TV Time CSVs into the canonical intermediate model the importer
 * consumes. Pure and dependency-free so it can be unit-tested on samples.
 *
 * Source of truth for the watch history is `tracking-prod-records-v2.csv`: it
 * holds one row per watched episode (the legacy `seen_episode_*` tables are
 * partial). An episode counts as watched simply by appearing there — the
 * `ep_watch_count`/`rewatch_count` columns are summary fields, empty on most
 * rows, and are not the per-episode signal.
 */
export function parseTvTimeExport(files: TvTimeImportFilesDto): ParsedExport {
  const rewatchByEpisodeId = parseRewatches(files.rewatchedCsv);
  const shows = parseShows(
    files.episodesCsv,
    files.showsCsv,
    rewatchByEpisodeId,
  );
  const movies = parseMovies(files.recordsCsv);
  return { shows, movies };
}

/** episode_id → number of rewatches (extra watches beyond the first). */
function parseRewatches(csv?: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!csv) return map;

  for (const row of parseCsv(csv)) {
    const episodeId = row.episode_id?.trim();
    const cpt = toInt(row.cpt);

    if (episodeId && cpt !== null && cpt > 0) {
      map.set(episodeId, cpt);
    }
  }

  return map;
}

function parseShows(
  episodesCsv: string | undefined,
  showsCsv: string | undefined,
  rewatchByEpisodeId: Map<string, number>,
): ParsedShow[] {
  const names = parseShowNames(showsCsv);
  const byTvdbId = new Map<string, ParsedShow>();

  // 1. Shows with watched episodes, from the source-of-truth table.
  for (const row of episodesCsv ? parseCsv(episodesCsv) : []) {
    // `bulk_type` (""/"fill-previous"/"season") only records HOW the watch was
    // entered — every row with an episode id is a real watched episode. Rows
    // without one (e.g. the series-follow record) are skipped just below.
    const tvdbId = row.s_id?.trim();
    const episodeId = row.episode_id?.trim();
    const season = toInt(row.season_number);
    const episode = toInt(row.episode_number);
    if (!tvdbId || !episodeId || season === null || episode === null) continue;

    let show = byTvdbId.get(tvdbId);

    if (!show) {
      show = {
        tvdbId,
        name: names.get(tvdbId)?.name ?? row.series_name?.trim() ?? tvdbId,
        episodes: [],
      };
      byTvdbId.set(tvdbId, show);
    }

    // The table has several rows per episode; keep the first, earliest date.
    const existing = show.episodes.find(
      (e) => e.season === season && e.episode === episode,
    );
    const watchedAt = toDateOrNull(row.created_at);

    if (existing) {
      existing.watchedAt = earliest(existing.watchedAt, watchedAt);
    } else {
      show.episodes.push({
        season,
        episode,
        tvdbEpisodeId: episodeId,
        watchedAt,
        totalWatches: 1 + (rewatchByEpisodeId.get(episodeId) ?? 0),
      });
    }
  }

  // 2. Watchlist shows: followed but never started (0 episodes seen).
  for (const [tvdbId, entry] of names) {
    if (entry.nbSeen === 0 && !byTvdbId.has(tvdbId)) {
      byTvdbId.set(tvdbId, { tvdbId, name: entry.name, episodes: [] });
    }
  }

  return [...byTvdbId.values()];
}

interface ShowNameEntry {
  name: string;
  nbSeen: number;
}

/** tv_show_id → { name, episodes-seen count } from user_tv_show_data.csv. */
function parseShowNames(csv?: string): Map<string, ShowNameEntry> {
  const map = new Map<string, ShowNameEntry>();
  if (!csv) return map;

  for (const row of parseCsv(csv)) {
    const tvdbId = row.tv_show_id?.trim();
    if (!tvdbId) continue;
    map.set(tvdbId, {
      name: row.tv_show_name?.trim() || tvdbId,
      nbSeen: toInt(row.nb_episodes_seen) ?? 0,
    });
  }

  return map;
}

/** Movie accumulator while scanning tracking-prod-records.csv, before dates are sorted. */
interface MutableMovie {
  title: string;
  year: number | null;
  watched: boolean;
  dates: Date[];
}

/**
 * Movies from tracking-prod-records.csv: watched (`watch`/`rewatch` rows) vs
 * watchlist. Deduplicated by title only — the same movie shows up under
 * several `type` rows, sometimes with an empty `release_date`, so keying on
 * title+year would split it and let a later PLANNED row overwrite an earlier
 * COMPLETED one.
 *
 * `watch_date` is never populated for movies (only for the episode-summary
 * rows this same file also carries) — `created_at` is the only usable date,
 * same record-creation-time approximation as episodes. `type` disambiguates:
 * `watch` is the first watch, `rewatch` is one row per subsequent rewatch
 * (its own `created_at`, `rewatch_count` incrementing 1, 2, 3…), and
 * `rewatch_count` duplicates the latest `rewatch` row as a summary — not a
 * new event, skipped. `follow`/`towatch` carry no watch date.
 */
function parseMovies(csv?: string): ParsedMovie[] {
  if (!csv) return [];

  const byTitle = new Map<string, MutableMovie>();

  for (const row of parseCsv(csv)) {
    if (row.entity_type?.trim() !== "movie") continue;

    const title = row.movie_name?.trim();
    if (!title) continue;
    const type = row.type?.trim();
    if (type === "rewatch_count") continue; // Duplicate summary row.

    const year = toYear(row.release_date);
    const watched = type === "watch" || type === "rewatch";
    const watchedAt = watched ? toDateOrNull(row.created_at) : null;

    const key = title.toLowerCase();
    const existing = byTitle.get(key);

    if (existing) {
      existing.watched ||= watched;
      if (existing.year === null && year !== null) existing.year = year;
      if (watchedAt) existing.dates.push(watchedAt);
    } else {
      byTitle.set(key, {
        title,
        year,
        watched,
        dates: watchedAt ? [watchedAt] : [],
      });
    }
  }

  return [...byTitle.values()].map((m) => {
    const sorted = [...m.dates].sort((a, b) => a.getTime() - b.getTime());
    return {
      title: m.title,
      year: m.year,
      watched: m.watched,
      watchedAt: sorted[0] ?? null,
      rewatchedAt: sorted.slice(1),
    };
  });
}

function toInt(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function toYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = Number.parseInt(value.trim().slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

/**
 * Parses "2025-11-24 19:24:43" (and ISO); returns null on anything unusable.
 * TV Time timestamps carry no zone — treat them as UTC so imported dates do
 * not drift with the server's local offset.
 */
function toDateOrNull(value: string | undefined): Date | null {
  if (!value || value.trim() === "") return null;
  let normalized = value.trim().replace(" ", "T");
  if (!/[Zz]|[+-]\d\d:?\d\d$/.test(normalized)) normalized += "Z";
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function earliest(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}
