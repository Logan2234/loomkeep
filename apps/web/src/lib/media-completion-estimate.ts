import {
  episodeRuntimeFor,
  estimateCompletionDate,
  type MediaDetailDto,
} from "@loomkeep/shared";
import { timeLeftToWatch } from "./pile";

export function mediaCompletionEstimate(
  detail: Pick<MediaDetailDto, "type" | "runtimeMin" | "seasons">,
  timezone = "UTC",
  now = new Date(),
): string | null {
  const remaining = timeLeftToWatch(
    detail.type,
    detail.runtimeMin,
    detail.seasons,
    now,
  );
  const activity = detail.seasons
    .filter((season) => season.number !== 0)
    .flatMap((season) => season.episodes)
    .flatMap((episode) => {
      const firstWatch = episode.watches
        .flatMap((watch) => (watch.watchedAt ? [watch.watchedAt] : []))
        .sort()[0];
      return firstWatch
        ? [
            {
              occurredAt: firstWatch,
              minutes: episodeRuntimeFor(
                detail.type,
                episode.runtimeMin,
                detail.runtimeMin,
              ),
            },
          ]
        : [];
    });
  return estimateCompletionDate(
    remaining?.minutes ?? null,
    activity,
    timezone,
    now,
  );
}
