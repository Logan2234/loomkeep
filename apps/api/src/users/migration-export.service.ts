import type { MigrationExportFileDto } from "@loomkeep/shared";
import { ReviewTargetType } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type { BookStatus } from "@prisma/client";
import { toCsv } from "../common/csv.util";
import { utcDateKey } from "../common/date.util";
import { PrismaService } from "../prisma/prisma.service";

type CsvRow = (string | number | null)[];

// Letterboxd rejects any import file over 1 MB and asks for it to be split.
const LETTERBOXD_MAX_BYTES = 1_000_000;

const LETTERBOXD_DIARY_HEADER = [
  "tmdbID",
  "imdbID",
  "Title",
  "Year",
  "Rating10",
  "WatchedDate",
  "Rewatch",
  "Review",
];

const LETTERBOXD_WATCHLIST_HEADER = ["tmdbID", "imdbID", "Title", "Year"];

// The columns of Goodreads' own export, which both Goodreads and StoryGraph
// import — a subset, as neither requires the rest.
const GOODREADS_HEADER = [
  "Title",
  "Author",
  "Additional Authors",
  "ISBN",
  "ISBN13",
  "My Rating",
  "Number of Pages",
  "Year Published",
  "Date Read",
  "Date Added",
  "Bookshelves",
  "Exclusive Shelf",
  "My Review",
  "Read Count",
];

// Goodreads has no built-in "did not finish" shelf: readers file those books
// on a custom one, which is also what the Goodreads import reads back as DROPPED.
const GOODREADS_SHELF: Record<BookStatus, string> = {
  READ: "read",
  READING: "currently-reading",
  TO_READ: "to-read",
  DROPPED: "did-not-finish",
};

interface ReviewFields {
  rating: number;
  text: string | null;
}

/**
 * A library in another service's import format, so leaving Loomkeep (or
 * mirroring it elsewhere) costs nothing. Private notes are never exported;
 * review texts only on request — a review shared with friends here would
 * become public over there.
 */
@Injectable()
export class MigrationExportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Watched films as a diary (one row per viewing), planned ones as a watchlist. */
  async buildLetterboxd(
    userId: string,
    withReviews: boolean,
  ): Promise<MigrationExportFileDto[]> {
    const entries = await this.prisma.libraryEntry.findMany({
      where: {
        userId,
        status: { in: ["COMPLETED", "PLANNED"] },
        mediaItem: {
          OR: [{ type: "MOVIE" }, { type: "ANIME", format: "MOVIE" }],
        },
      },
      include: {
        mediaItem: { include: { externalIds: true } },
        replays: { orderBy: { finishedAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });
    const reviews = await this.reviewsFor(
      userId,
      ReviewTargetType.MEDIA,
      entries.map((e) => e.mediaItemId),
    );
    const animeViewings = await this.animeFilmViewings(
      userId,
      entries
        .filter((e) => e.mediaItem.type === "ANIME")
        .map((e) => e.mediaItemId),
    );

    const diary: CsvRow[] = [];
    const watchlist: CsvRow[] = [];

    for (const entry of entries) {
      const item = entry.mediaItem;
      const ids = [
        item.externalIds.find((ext) => ext.source === "TMDB")?.externalId ??
          null,
        item.externalIds.find((ext) => ext.source === "IMDB")?.externalId ??
          null,
        item.title,
        item.releaseDate?.getUTCFullYear() ?? null,
      ];

      if (entry.status === "PLANNED") {
        watchlist.push(ids);
        continue;
      }

      // A movie's first viewing is the entry itself and each rewatch a
      // MovieReplay; an anime film is watched like any anime, per episode.
      const viewings =
        item.type === "MOVIE"
          ? [entry.finishedAt, ...entry.replays.map((r) => r.finishedAt)]
          : (animeViewings.get(item.id) ?? [entry.finishedAt]);
      const review = reviews.get(item.id);

      viewings.forEach((watchedAt, index) => {
        const isLatest = index === viewings.length - 1;
        diary.push([
          ...ids,
          letterboxdRating(review?.rating),
          dashedDate(watchedAt),
          index > 0 ? "true" : "false",
          withReviews && isLatest ? letterboxdReview(review?.text) : null,
        ]);
      });
    }

    return [
      ...splitCsv(LETTERBOXD_DIARY_HEADER, diary).map((csv, index) => ({
        name:
          index === 0 ? "letterboxd-diary" : `letterboxd-diary-${index + 1}`,
        csv,
      })),
      ...splitCsv(LETTERBOXD_WATCHLIST_HEADER, watchlist).map((csv, index) => ({
        name:
          index === 0
            ? "letterboxd-watchlist"
            : `letterboxd-watchlist-${index + 1}`,
        csv,
      })),
    ];
  }

  /** Every book, in the Goodreads library export format. */
  async buildGoodreads(
    userId: string,
    withReviews: boolean,
  ): Promise<MigrationExportFileDto[]> {
    const entries = await this.prisma.bookEntry.findMany({
      where: { userId },
      include: {
        bookItem: true,
        readings: {
          where: { status: "COMPLETED" },
          orderBy: { number: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    if (entries.length === 0) return [];

    const reviews = await this.reviewsFor(
      userId,
      ReviewTargetType.BOOK,
      entries.map((e) => e.bookItemId),
    );

    const rows = entries.map((entry): CsvRow => {
      const book = entry.bookItem;
      const review = reviews.get(book.id);
      const isbn = book.isbn ?? "";
      const finishes = entry.readings.flatMap((reading) =>
        reading.finishedAt ? [reading.finishedAt] : [],
      );
      const lastRead = finishes.reduce<Date | null>(
        (latest, date) => (latest && latest > date ? latest : date),
        null,
      );

      return [
        book.title,
        book.authors[0] ?? null,
        book.authors.slice(1).join(", "),
        isbn.length === 10 ? isbn : null,
        isbn.length === 13 ? isbn : null,
        goodreadsRating(review?.rating),
        book.pageCount,
        book.releaseDate?.getUTCFullYear() ?? null,
        slashedDate(lastRead),
        slashedDate(entry.createdAt),
        entry.status === "DROPPED" ? GOODREADS_SHELF.DROPPED : null,
        GOODREADS_SHELF[entry.status],
        withReviews ? (review?.text ?? null) : null,
        entry.readings.length,
      ];
    });

    return [
      { name: "goodreads-library", csv: toCsv([GOODREADS_HEADER, ...rows]) },
    ];
  }

  private async reviewsFor(
    userId: string,
    targetType: ReviewTargetType,
    targetIds: string[],
  ): Promise<Map<string, ReviewFields>> {
    if (targetIds.length === 0) return new Map();

    const rows = await this.prisma.review.findMany({
      where: { userId, targetType, targetId: { in: targetIds } },
      select: { targetId: true, rating: true, text: true },
    });
    return new Map(rows.map((r) => [r.targetId, r]));
  }

  /** Each anime film's viewings, oldest first — one EpisodeWatch per viewing. */
  private async animeFilmViewings(
    userId: string,
    mediaItemIds: string[],
  ): Promise<Map<string, (Date | null)[]>> {
    if (mediaItemIds.length === 0) return new Map();

    const watches = await this.prisma.episodeWatch.findMany({
      where: {
        userId,
        episode: { season: { mediaItemId: { in: mediaItemIds } } },
      },
      select: {
        watchedAt: true,
        episode: { select: { season: { select: { mediaItemId: true } } } },
      },
      orderBy: { watchedAt: "asc" },
    });

    const byItem = new Map<string, (Date | null)[]>();

    for (const watch of watches) {
      const itemId = watch.episode.season.mediaItemId;
      const group = byItem.get(itemId);
      if (group) group.push(watch.watchedAt);
      else byItem.set(itemId, [watch.watchedAt]);
    }

    return byItem;
  }
}

/**
 * Header-led CSV parts that each stay under Letterboxd's size cap. None when
 * there is no row: an empty watchlist file would only be noise to import.
 */
function splitCsv(header: string[], rows: CsvRow[]): string[] {
  const head = toCsv([header]);
  const parts: string[][] = [];
  let lines: string[] = [];
  let bytes = Buffer.byteLength(head);

  for (const row of rows) {
    const line = toCsv([row]);
    const lineBytes = Buffer.byteLength(line) + 2;

    if (lines.length > 0 && bytes + lineBytes > LETTERBOXD_MAX_BYTES) {
      parts.push(lines);
      lines = [];
      bytes = Buffer.byteLength(head);
    }

    lines.push(line);
    bytes += lineBytes;
  }

  if (lines.length > 0) parts.push(lines);
  return parts.map((part) => [head, ...part].join("\r\n"));
}

// Loomkeep rates 0–10 with half points from imports; Letterboxd takes whole
// numbers 1–10, and 0 here means "not rated" rather than a zero.
function letterboxdRating(rating: number | undefined): number | null {
  if (!rating) return null;
  return Math.max(1, Math.round(rating));
}

// Goodreads' own export writes 0 for an unrated book.
function goodreadsRating(rating: number | undefined): number {
  return rating ? Math.ceil(rating / 2) : 0;
}

// Letterboxd renders the Review column as HTML: escape what would otherwise
// be read as markup, and keep the paragraphs.
function letterboxdReview(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br>");
}

function dashedDate(date: Date | null): string | null {
  return date ? utcDateKey(date) : null;
}

function slashedDate(date: Date | null): string | null {
  return dashedDate(date)?.replace(/-/g, "/") ?? null;
}
