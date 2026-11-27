import type { EventsGateway } from "../events/events.gateway";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { XpService } from "../gamification/xp.service";
import type { ListService } from "../lists/list.service";
import { MediaDetailService } from "../media/media-detail.service";
import { MediaEpisodesService } from "../media/media-episodes.service";
import type { MediaItemService } from "../media/media-item.service";
import { MediaLibraryService } from "../media/media-library.service";
import { MediaProgressService } from "../media/media-progress.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReviewService } from "../reviews/review.service";
import type { ActivityService } from "../social/activity.service";
import type { AgeGateService } from "../users/age-gate.service";

/** The media services wired together from the same dependencies, as in MediaModule. */
export function mediaServices(
  prisma: PrismaService,
  mediaItems: MediaItemService,
  ageGate: AgeGateService,
  reviews: ReviewService,
  activity: ActivityService,
  xp: XpService,
  achievements: AchievementService,
  events: EventsGateway,
  lists: ListService,
) {
  const progress = new MediaProgressService(prisma, xp, achievements);
  const episodes = new MediaEpisodesService(
    prisma,
    activity,
    xp,
    achievements,
    progress,
  );
  const detail = new MediaDetailService(
    prisma,
    mediaItems,
    ageGate,
    reviews,
    progress,
  );
  const library = new MediaLibraryService(
    prisma,
    mediaItems,
    ageGate,
    reviews,
    activity,
    xp,
    achievements,
    events,
    lists,
    progress,
    episodes,
  );
  return { progress, episodes, detail, library };
}

// Public members only: the classes share private fields (prisma, xp…), and
// an intersection of classes with the same private field is never.
type Public<T> = Pick<T, keyof T>;
export type MediaFacade = Public<MediaLibraryService> &
  Public<MediaEpisodesService> &
  Public<MediaDetailService> &
  Public<MediaProgressService>;

/**
 * One object answering every media service's methods, for specs that test
 * the media library end to end: each call goes to the service that owns the
 * method. To spy on a call between services, spy on mediaServices()'s
 * instances instead.
 */
export function mediaFacade(
  ...dependencies: Parameters<typeof mediaServices>
): MediaFacade {
  const facade: Record<string, unknown> = {};

  for (const service of Object.values(mediaServices(...dependencies))) {
    const prototype = Object.getPrototypeOf(service) as object;

    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name === "constructor" || name in facade) continue;
      const member = (service as unknown as Record<string, unknown>)[name];
      if (typeof member === "function") facade[name] = member.bind(service);
    }
  }

  return facade as MediaFacade;
}
