import type { MediaType } from "@loomkeep/shared";

/** A released episode of a tracked show, considered for a notification. */
export interface CandidateEpisode {
  episodeId: string;
  airDate: Date;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  mediaTitle: string;
  mediaType: MediaType;
  sourceId: string;
  /** When the user started tracking this media (their `LibraryEntry.createdAt`). */
  trackedSince: Date;
}

/** The payload persisted as a Notification row (minus user/read/date). */
export interface NewEpisodeNotification {
  episodeId: string;
  mediaTitle: string;
  mediaType: MediaType;
  sourceId: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  airDate: Date;
}

/**
 * Pick episodes newly released within `(since, now]`, not already notified,
 * and that aired after the user started tracking the show — otherwise
 * importing an already-finished show would "announce" its last episode as
 * news just because it happens to fall inside the detection window.
 * Pure so the detection window + dedup are unit-testable without a database.
 */
export function selectNewEpisodeNotifications(
  candidates: CandidateEpisode[],
  opts: { since: Date; now: Date; alreadyNotified: Set<string> },
): NewEpisodeNotification[] {
  const { since, now, alreadyNotified } = opts;
  return candidates
    .filter(
      (e) =>
        e.airDate > since &&
        e.airDate <= now &&
        e.airDate > e.trackedSince &&
        !alreadyNotified.has(e.episodeId),
    )
    .map((e) => ({
      episodeId: e.episodeId,
      mediaTitle: e.mediaTitle,
      mediaType: e.mediaType,
      sourceId: e.sourceId,
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      episodeTitle: e.episodeTitle,
      airDate: e.airDate,
    }));
}
