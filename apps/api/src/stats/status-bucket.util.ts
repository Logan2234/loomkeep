import type {
  BookStatus,
  EntryStatus,
  GameStatus,
  MusicStatus,
  StatsStatusBucket,
  StatusBucketCountDto,
} from "@tracklore/shared";

/**
 * Maps each domain's own status enum onto the shared stats vocabulary, so a
 * cross-domain view can sum counts without knowing every domain's states.
 * UP_TO_DATE (caught up, still airing) reads as DONE — the viewer has seen
 * everything there is to see, same intent as COMPLETED.
 */
export function bucketizeEntryStatus(status: EntryStatus): StatsStatusBucket {
  switch (status) {
    case "WATCHING":
      return "IN_PROGRESS";
    case "COMPLETED":
    case "UP_TO_DATE":
      return "DONE";
    case "PLANNED":
      return "PLANNED";
    case "DROPPED":
      return "DROPPED";
  }
}

export function bucketizeGameStatus(status: GameStatus): StatsStatusBucket {
  switch (status) {
    case "BACKLOG":
      return "PLANNED";
    case "PLAYING":
      return "IN_PROGRESS";
    case "COMPLETED":
      return "DONE";
    case "DROPPED":
      return "DROPPED";
  }
}

export function bucketizeBookStatus(status: BookStatus): StatsStatusBucket {
  switch (status) {
    case "TO_READ":
      return "PLANNED";
    case "READING":
      return "IN_PROGRESS";
    case "READ":
      return "DONE";
    case "DROPPED":
      return "DROPPED";
  }
}

/** Music has no IN_PROGRESS/DROPPED state — a listen is a single-session event. */
export function bucketizeMusicStatus(status: MusicStatus): StatsStatusBucket {
  switch (status) {
    case "TO_LISTEN":
      return "PLANNED";
    case "LISTENED":
      return "DONE";
  }
}

/** Counts already-bucketed statuses, omitting buckets with zero entries. */
export function countByBucket(
  buckets: StatsStatusBucket[],
): StatusBucketCountDto[] {
  const counts = new Map<StatsStatusBucket, number>();

  for (const bucket of buckets) {
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return [...counts.entries()].map(([bucket, count]) => ({ bucket, count }));
}
