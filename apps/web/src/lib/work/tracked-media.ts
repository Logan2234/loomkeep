import { listTrackedMedia } from "#lib/api/client.js";
import type { EntryStatus, MediaType } from "@loomkeep/shared/enums";

// Every query on `keys.library.tracked()` fetches through here: a cache key
// shared by two shapes of data would hand one screen the other's.

/** Identifies a title across catalogues: TMDB film and series ids overlap. */
export const trackKey = (type: MediaType, sourceId: string) =>
  `${type}:${sourceId}`;

/** The library's titles and their status, by {@link trackKey}. */
export async function fetchTrackedMedia(): Promise<Map<string, EntryStatus>> {
  return new Map(
    (await listTrackedMedia()).map((e) => [
      trackKey(e.type, e.sourceId),
      e.status,
    ]),
  );
}
