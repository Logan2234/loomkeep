import { workDomain } from "#lib/chat/work-library.js";
import {
  BOOK_STATUS_LABELS,
  GAME_STATUS_LABELS,
  MEDIA_STATUS_META,
  MUSIC_STATUS_LABELS,
} from "#lib/constants/status-labels.js";
import {
  Domain,
  type BookStatus,
  type EntryStatus,
  type GameStatus,
  type MusicStatus,
  type WorkSearchHitDto,
  type WorkSearchResultDto,
} from "@loomkeep/shared";

/** The domains the unified search covers: the ones with a catalogue. */
const SEARCHABLE: Domain[] = [
  Domain.MEDIA,
  Domain.GAMES,
  Domain.BOOKS,
  Domain.MUSIC,
];

/** Works a shelf shows; the rest is the domain's own tab away. */
export const SHELF_SIZE = 3;

export type Shelf =
  | { domain: Domain; state: "results"; hits: WorkSearchHitDto[] }
  | { domain: Domain; state: "loading" | "unavailable" };

/**
 * One shelf per domain, in the order the user gave their domains. While the
 * catalogues are still asked, a domain with nothing yet waits as a loading
 * shelf; once they answered, an empty one goes, unless its catalogue failed.
 */
export function shelves(
  order: Domain[],
  answer: WorkSearchResultDto | undefined,
  settled: boolean,
): Shelf[] {
  return order
    .filter((domain) => SEARCHABLE.includes(domain))
    .flatMap((domain): Shelf[] => {
      const hits = (answer?.items ?? []).filter(
        (hit) => workDomain(hit.kind) === domain,
      );

      if (hits.length > 0) {
        return [{ domain, state: "results", hits: hits.slice(0, SHELF_SIZE) }];
      }

      if (!settled) return [{ domain, state: "loading" }];
      return answer?.unavailable.includes(domain)
        ? [{ domain, state: "unavailable" }]
        : [];
    });
}

/** The viewer's status for a work they track, in its domain's words. */
export function statusLabel(hit: WorkSearchHitDto): string | null {
  if (!hit.status) return null;

  switch (workDomain(hit.kind)) {
    case Domain.MEDIA:
      return MEDIA_STATUS_META[hit.status as EntryStatus]?.label ?? null;
    case Domain.GAMES:
      return GAME_STATUS_LABELS[hit.status as GameStatus] ?? null;
    case Domain.BOOKS:
      return BOOK_STATUS_LABELS[hit.status as BookStatus] ?? null;
    default:
      return MUSIC_STATUS_LABELS[hit.status as MusicStatus] ?? null;
  }
}
