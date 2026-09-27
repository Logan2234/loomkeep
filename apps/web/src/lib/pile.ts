import { formatHours, formatNumber, hoursParts } from "$lib/format";
import { m } from "$lib/paraglide/messages";
import {
  Domain,
  episodeRuntimeFor,
  isRuntimeKnown,
  type MediaDetailSeasonDto,
  type MediaType,
  type PileSummaryDto,
  type StatsDomain,
} from "@loomkeep/shared";

// "~" marks an estimate: an IGDB average, or a video length that fell back to
// the per-type default.
const approx = (pile: PileSummaryDto) => (pile.estimated ? "~" : "");

const PHRASE: Record<StatsDomain, (amount: string) => string> = {
  [Domain.MEDIA]: (amount) => m.pile_to_watch({ amount }),
  [Domain.GAMES]: (amount) => m.pile_to_play({ amount }),
  [Domain.BOOKS]: (amount) => m.pile_to_read({ amount }),
  [Domain.MUSIC]: (amount) => m.pile_to_listen({ amount }),
};

const TILE_LABEL: Record<StatsDomain, () => string> = {
  [Domain.MEDIA]: () => m.pile_tile_to_watch(),
  [Domain.GAMES]: () => m.pile_tile_to_play(),
  [Domain.BOOKS]: () => m.pile_tile_to_read(),
  [Domain.MUSIC]: () => m.pile_tile_to_listen(),
};

// Video has none: a title with no length counts at a per-type default.
const COVERAGE: Partial<Record<StatsDomain, (pct: number) => string>> = {
  [Domain.GAMES]: (pct) => m.pile_coverage_games({ pct }),
  [Domain.BOOKS]: (pct) => m.pile_coverage_books({ pct }),
  [Domain.MUSIC]: (pct) => m.pile_coverage_music({ pct }),
};

const ENTRIES: Record<StatsDomain, (count: number) => string> = {
  [Domain.MEDIA]: (count) =>
    count === 1
      ? m.media_library_count_one({ count })
      : m.media_library_count_many({ count }),
  [Domain.GAMES]: (count) =>
    count === 1
      ? m.game_library_count_one({ count })
      : m.game_library_count_many({ count }),
  [Domain.BOOKS]: (count) =>
    count === 1
      ? m.book_library_count_one({ count })
      : m.book_library_count_many({ count }),
  [Domain.MUSIC]: (count) =>
    count === 1
      ? m.music_library_count_one({ count })
      : m.music_library_count_many({ count }),
};

/** Nothing left, or nothing we can put a figure on: the pile isn't shown. */
export function isPileEmpty(pile: PileSummaryDto): boolean {
  return pile.counted === 0 || pile.amount === 0;
}

/** "sur 94 % des livres" when part of the pile had no data, else null. */
export function pileCoverage(
  domain: StatsDomain,
  pile: PileSummaryDto,
): string | null {
  const coverage = COVERAGE[domain];
  if (!coverage || pile.counted >= pile.entries) return null;
  return coverage(Math.round((pile.counted / pile.entries) * 100));
}

/** The library header's suffix: "~640 h à jouer · estimé sur 71 % des jeux". */
export function pileHeaderLabel(
  domain: StatsDomain,
  pile: PileSummaryDto,
): string | null {
  if (isPileEmpty(pile)) return null;
  const amount =
    pile.unit === "PAGES"
      ? m.pile_pages({ count: formatNumber(pile.amount) })
      : formatHours(pile.amount);
  return [
    PHRASE[domain](`${approx(pile)}${amount}`),
    pileCoverage(domain, pile),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The /stats tile: figure, unit, label and hint, StatTile-shaped. */
export function pileTile(domain: StatsDomain, pile: PileSummaryDto) {
  const { value, unit } =
    pile.unit === "PAGES"
      ? { value: formatNumber(pile.amount), unit: m.pile_pages_short() }
      : hoursParts(pile.amount);
  return {
    value: `${approx(pile)}${value}`,
    unit: ` ${unit}`,
    label: TILE_LABEL[domain](),
    hint: pileCoverage(domain, pile) ?? ENTRIES[domain](pile.entries),
  };
}

/**
 * What's left of one series on its page: the aired, unwatched episodes,
 * specials (season 0) aside — the same count as its progress bar, timed by
 * the same length rule as the API's pile. Null when nothing's left.
 */
export function timeLeftToWatch(
  type: MediaType,
  itemRuntimeMin: number | null,
  seasons: MediaDetailSeasonDto[],
  now = new Date(),
): { minutes: number; estimated: boolean } | null {
  const left = seasons
    .filter((season) => season.number !== 0)
    .flatMap((season) => season.episodes)
    .filter(
      (e) =>
        e.watchCount === 0 &&
        (e.airDate === null || new Date(e.airDate) <= now),
    );
  if (left.length === 0) return null;

  return {
    minutes: left.reduce(
      (sum, e) => sum + episodeRuntimeFor(type, e.runtimeMin, itemRuntimeMin),
      0,
    ),
    estimated: left.some((e) => !isRuntimeKnown(e.runtimeMin, itemRuntimeMin)),
  };
}
