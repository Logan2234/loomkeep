import type {
  ApiV1LibraryEntryDto,
  ApiV1TargetDto,
  ApiV1WorkDto,
  BookEntryDto,
  GameEntryDto,
  LibraryEntryDto,
  MediaItemDto,
  MusicEntryDto,
  ReviewTargetSummaryDto,
  ReviewTargetType,
} from "@loomkeep/shared";
import {
  bucketizeBookStatus,
  bucketizeEntryStatus,
  bucketizeGameStatus,
  bucketizeMusicStatus,
} from "../../stats/status-bucket.util";

/** Absolute link into the web app, from its `/app/...` path. */
export function webUrl(webOrigin: string, path: string): string {
  return `${webOrigin}${path}`;
}

export function mediaWork(
  media: MediaItemDto,
  webOrigin: string,
): ApiV1WorkDto {
  return {
    id: media.id,
    domain: "MEDIA",
    type: media.type,
    title: media.title,
    creators: [],
    coverUrl: media.posterUrl,
    source: media.canonicalSource,
    sourceId: media.sourceId,
    url: webUrl(
      webOrigin,
      `/app/media/${media.type.toLowerCase()}/${media.sourceId}`,
    ),
  };
}

/** A list item's or a review's target, from the summary the web app gets. */
export function toTarget(
  type: ReviewTargetType,
  id: string,
  summary: ReviewTargetSummaryDto | null,
  webOrigin: string,
): ApiV1TargetDto {
  return {
    type,
    id,
    title: summary?.title ?? null,
    imageUrl: summary?.imageUrl ?? null,
    url: summary?.href ? webUrl(webOrigin, summary.href) : null,
  };
}

export function fromMediaEntry(
  entry: LibraryEntryDto,
  webOrigin: string,
): ApiV1LibraryEntryDto {
  return {
    ...common(entry),
    domain: "MEDIA",
    status: entry.status,
    phase: bucketizeEntryStatus(entry.status),
    progress: entry.progress && {
      current: entry.progress.watchedEpisodes,
      total: entry.progress.totalEpisodes,
      unit: "episodes",
    },
    work: mediaWork(entry.mediaItem, webOrigin),
  };
}

export function fromGameEntry(
  entry: GameEntryDto,
  webOrigin: string,
): ApiV1LibraryEntryDto {
  const game = entry.game;
  return {
    ...common(entry),
    domain: "GAMES",
    status: entry.status,
    phase: bucketizeGameStatus(entry.status),
    progress:
      entry.playtimeMinutes > 0
        ? { current: entry.playtimeMinutes, total: null, unit: "minutes" }
        : null,
    work: {
      id: game.id,
      domain: "GAMES",
      type: null,
      title: game.title,
      creators: [],
      coverUrl: game.coverUrl,
      source: game.canonicalSource,
      sourceId: game.sourceId,
      url: webUrl(webOrigin, `/app/games/${game.sourceId}`),
    },
  };
}

export function fromBookEntry(
  entry: BookEntryDto,
  webOrigin: string,
): ApiV1LibraryEntryDto {
  const book = entry.book;
  return {
    ...common(entry),
    domain: "BOOKS",
    status: entry.status,
    phase: bucketizeBookStatus(entry.status),
    progress: {
      current: entry.currentPage,
      total: entry.referencePageCount ?? book.pageCount,
      unit: "pages",
    },
    work: {
      id: book.id,
      domain: "BOOKS",
      type: null,
      title: book.title,
      creators: book.authors,
      coverUrl: book.coverUrl,
      source: book.canonicalSource,
      sourceId: book.sourceId,
      url: webUrl(webOrigin, `/app/books/${book.sourceId}`),
    },
  };
}

export function fromMusicEntry(
  entry: MusicEntryDto,
  webOrigin: string,
): ApiV1LibraryEntryDto {
  const album = entry.album;
  return {
    ...common(entry),
    domain: "MUSIC",
    status: entry.status,
    phase: bucketizeMusicStatus(entry.status),
    progress: null,
    work: {
      id: album.id,
      domain: "MUSIC",
      type: null,
      title: album.title,
      creators: album.artists,
      coverUrl: album.coverUrl,
      source: album.canonicalSource,
      sourceId: album.sourceId,
      url: webUrl(webOrigin, `/app/music/${album.sourceId}`),
    },
  };
}

function common(
  entry: Pick<
    LibraryEntryDto,
    | "id"
    | "favorite"
    | "rating"
    | "notes"
    | "startedAt"
    | "finishedAt"
    | "createdAt"
  >,
) {
  return {
    id: entry.id,
    favorite: entry.favorite,
    rating: entry.rating,
    notes: entry.notes,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    addedAt: entry.createdAt,
  };
}
