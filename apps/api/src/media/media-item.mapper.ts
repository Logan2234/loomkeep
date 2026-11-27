import { type MediaItemDto } from "@loomkeep/shared/contracts";
import {
  isAnimeUnaired,
  movieReleaseDates,
  movieReleaseInfo,
} from "@loomkeep/shared/rules";
import type { MediaExternalId, MediaItem } from "@prisma/client";
import { canonicalExternalId } from "../common/external-id.util";

/** A media item as lists, cards and the calendar show it. */
export function toMediaItemDto(
  media: MediaItem & { externalIds: MediaExternalId[] },
  translatedTitle?: string,
): MediaItemDto {
  return {
    id: media.id,
    type: media.type,
    title: translatedTitle ?? media.title,
    posterUrl: media.posterUrl,
    canonicalSource: media.canonicalSource,
    sourceId: canonicalExternalId(media, media.externalIds),
    ...((media.type === "MOVIE" &&
      movieReleaseInfo(
        movieReleaseDates(media.movieReleaseDates),
        media.status,
        "US",
      ).upcoming) ||
    (media.type === "ANIME" && isAnimeUnaired(media.status))
      ? { upcoming: true }
      : {}),
  };
}
