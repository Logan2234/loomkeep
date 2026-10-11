import { Domain, type WorkSearchHitDto } from "@loomkeep/shared";
import { titleRelevance } from "../catalog/search-ranking";

/** The domains a work search covers: the ones with a catalogue. */
export const SEARCH_DOMAINS = [
  Domain.MEDIA,
  Domain.GAMES,
  Domain.BOOKS,
  Domain.MUSIC,
] as const;
export type SearchDomain = (typeof SEARCH_DOMAINS)[number];

const ACCENTED: Record<string, string> = {
  a: "àáâãäåāăą",
  c: "çćĉċč",
  d: "ďđ",
  e: "èéêëēĕėęě",
  g: "ĝğġģ",
  i: "ìíîïĩīĭį",
  l: "ĺļľŀł",
  n: "ñńņň",
  o: "òóôõöøōŏő",
  r: "ŕŗř",
  s: "śŝşš",
  t: "ţťŧ",
  u: "ùúûüũūŭůűų",
  y: "ýÿŷ",
  z: "źżž",
};

const FOLDS = Object.entries(ACCENTED).flatMap(([base, variants]) =>
  [...variants].flatMap((variant) => [
    [variant, base],
    [variant.toUpperCase(), base],
  ]),
);

/**
 * `translate()`'s two arguments: what the instance's own works are matched
 * through in SQL. Postgres' `unaccent` would need an extension, which lives
 * in one schema — the e2e schema wouldn't see it.
 */
export const FOLD_FROM = FOLDS.map(([from]) => from).join("");
export const FOLD_TO = FOLDS.map(([, to]) => to).join("");

const FOLD = new Map(FOLDS as [string, string][]);

/** What SQL's `lower(translate(value, FOLD_FROM, FOLD_TO))` makes of `value`. */
export function foldForSearch(value: string): string {
  return [...value]
    .map((char) => FOLD.get(char) ?? char)
    .join("")
    .toLowerCase();
}

export interface ParsedWorkQuery {
  /** What catalogues are asked for. */
  text: string;
  /** "dune 2021": the year a work is preferred from. */
  year: number | null;
  /** Its bare digits, when the query is an ISBN: only books then. */
  isbn: string | null;
}

const ISBN = /^(?:97[89])?\d{9}[\dX]$/i;
const TRAILING_YEAR = /^(.*\S)\s+((?:18|19|20)\d{2})$/;

export function parseWorkQuery(raw: string): ParsedWorkQuery {
  const query = raw.trim();
  const digits = query.replace(/[\s-]/g, "");

  if (ISBN.test(digits)) {
    return { text: query, year: null, isbn: digits.toUpperCase() };
  }

  const dated = TRAILING_YEAR.exec(query);
  return dated
    ? { text: dated[1], year: Number(dated[2]), isbn: null }
    : { text: query, year: null, isbn: null };
}

/** A work found, before it's ranked against the others. */
export interface WorkCandidate {
  domain: SearchDomain;
  /** Its catalogue identity: what the viewer's entries are matched by. */
  source: string;
  sourceId: string;
  hit: WorkSearchHitDto;
  /** Its rank in what its own source returned: the source's popularity. */
  index: number;
  /** Accounts of the instance tracking it. */
  trackers: number;
}

/**
 * Best first. Title relevance leads; within a tier, a year typed after the
 * title — the work's year, or part of its title as in "Blade Runner 2049" —
 * then the viewer's own library, then what the instance tracks. Ties go by
 * each source's own order, a domain at a time, so one catalogue's long list
 * doesn't bury the others.
 */
export function rankWorks(
  candidates: WorkCandidate[],
  raw: string,
  query: ParsedWorkQuery,
): WorkCandidate[] {
  const dated = query.year !== null;

  const score = ({ hit, trackers }: WorkCandidate) => {
    const whole = titleRelevance([hit.title], raw);
    const relevance = Math.max(whole, titleRelevance([hit.title], query.text));
    return (
      relevance * 20 +
      (dated && whole > 0 ? 5 : 0) +
      (dated && hit.year === query.year ? 5 : 0) +
      (hit.status ? 3 : 0) +
      (trackers > 0 ? 1 : 0)
    );
  };

  return candidates
    .map((candidate) => ({ candidate, score: score(candidate) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.index - b.candidate.index ||
        SEARCH_DOMAINS.indexOf(a.candidate.domain) -
          SEARCH_DOMAINS.indexOf(b.candidate.domain),
    )
    .map(({ candidate }) => candidate);
}
