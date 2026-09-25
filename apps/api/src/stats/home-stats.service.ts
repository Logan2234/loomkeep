import type { OnThisDayEntryDto, StatsDomain } from "@loomkeep/shared";
import { Domain } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { canonicalExternalId } from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { DomainGateService } from "../users/domain-gate.service";
import { anniversaryWindow, rankByAnniversary } from "./on-this-day.util";

const externalIds = {
  canonicalSource: true,
  externalIds: { select: { source: true, externalId: true } },
} as const;

/**
 * The home-page widget that needs its own query: what you were on a year
 * ago ("Il y a un an"). Counting stats, so free — nothing here is premium.
 */
@Injectable()
export class HomeStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainGate: DomainGateService,
  ) {}

  async onThisDay(userId: string, date: string): Promise<OnThisDayEntryDto[]> {
    const enabled = await this.domainGate.getEnabledDomains(userId);
    const { center, from, to } = anniversaryWindow(date);
    const within = { gte: from, lt: to };
    const entries: OnThisDayEntryDto[] = [];
    const push = (
      domain: StatsDomain,
      work: { title: string; imageUrl: string | null; href: string | null },
      kind: OnThisDayEntryDto["kind"],
      at: Date,
      count = 1,
    ) => entries.push({ domain, ...work, kind, date: at.toISOString(), count });
    const inWindow = (at: Date | null): at is Date =>
      !!at && at >= from && at < to;

    const tasks: Promise<void>[] = [];

    if (enabled.includes(Domain.MEDIA)) {
      tasks.push(
        (async () => {
          const watches = await this.prisma.episodeWatch.findMany({
            where: { userId, watchedAt: within },
            select: {
              watchedAt: true,
              episode: {
                select: {
                  season: {
                    select: {
                      mediaItem: {
                        select: {
                          id: true,
                          title: true,
                          posterUrl: true,
                          type: true,
                          ...externalIds,
                        },
                      },
                    },
                  },
                },
              },
            },
          });
          // One line per show, dated by its last episode that week.
          const byShow = new Map<
            string,
            {
              item: (typeof watches)[number]["episode"]["season"]["mediaItem"];
              at: Date;
              count: number;
            }
          >();

          for (const watch of watches) {
            const item = watch.episode.season.mediaItem;
            const at = watch.watchedAt!;
            const seen = byShow.get(item.id);
            if (seen) {
              seen.count++;
              if (at > seen.at) seen.at = at;
            } else byShow.set(item.id, { item, at, count: 1 });
          }

          for (const { item, at, count } of byShow.values()) {
            push(Domain.MEDIA, mediaWork(item), "watched", at, count);
          }

          const movies = await this.prisma.libraryEntry.findMany({
            where: {
              userId,
              mediaItem: { type: "MOVIE" },
              OR: [
                { finishedAt: within },
                { replays: { some: { finishedAt: within } } },
              ],
            },
            select: {
              finishedAt: true,
              replays: {
                where: { finishedAt: within },
                select: { finishedAt: true },
              },
              mediaItem: {
                select: {
                  title: true,
                  posterUrl: true,
                  type: true,
                  ...externalIds,
                },
              },
            },
          });

          for (const movie of movies) {
            const at = inWindow(movie.finishedAt)
              ? movie.finishedAt
              : movie.replays[0].finishedAt;
            push(Domain.MEDIA, mediaWork(movie.mediaItem), "watched", at);
          }
        })(),
      );
    }

    if (enabled.includes(Domain.GAMES)) {
      tasks.push(
        (async () => {
          const games = await this.prisma.gameEntry.findMany({
            where: {
              userId,
              OR: [
                { startedAt: within },
                { finishedAt: within },
                { replays: { some: { finishedAt: within } } },
              ],
            },
            select: {
              startedAt: true,
              finishedAt: true,
              replays: {
                where: { finishedAt: within },
                select: { finishedAt: true },
              },
              gameItem: {
                select: { title: true, coverUrl: true, ...externalIds },
              },
            },
          });

          for (const game of games) {
            const work = {
              title: game.gameItem.title,
              imageUrl: game.gameItem.coverUrl,
              href: workHref("games", game.gameItem),
            };
            pushTimeline(push, Domain.GAMES, work, game, inWindow);
          }
        })(),
      );
    }

    if (enabled.includes(Domain.BOOKS)) {
      tasks.push(
        (async () => {
          const books = await this.prisma.bookEntry.findMany({
            where: {
              userId,
              OR: [
                { startedAt: within },
                { finishedAt: within },
                { replays: { some: { finishedAt: within } } },
              ],
            },
            select: {
              startedAt: true,
              finishedAt: true,
              replays: {
                where: { finishedAt: within },
                select: { finishedAt: true },
              },
              bookItem: {
                select: { title: true, coverUrl: true, ...externalIds },
              },
            },
          });

          for (const book of books) {
            const work = {
              title: book.bookItem.title,
              imageUrl: book.bookItem.coverUrl,
              href: workHref("books", book.bookItem),
            };
            pushTimeline(push, Domain.BOOKS, work, book, inWindow);
          }
        })(),
      );
    }

    if (enabled.includes(Domain.MUSIC)) {
      tasks.push(
        (async () => {
          const albums = await this.prisma.musicEntry.findMany({
            where: {
              userId,
              OR: [{ startedAt: within }, { finishedAt: within }],
            },
            select: {
              startedAt: true,
              finishedAt: true,
              musicItem: {
                select: { title: true, coverUrl: true, ...externalIds },
              },
            },
          });

          for (const album of albums) {
            const work = {
              title: album.musicItem.title,
              imageUrl: album.musicItem.coverUrl,
              href: workHref("music", album.musicItem),
            };
            pushTimeline(
              push,
              Domain.MUSIC,
              work,
              { ...album, replays: [] },
              inWindow,
            );
          }
        })(),
      );
    }

    await Promise.all(tasks);
    return rankByAnniversary(entries, center);
  }
}

type WorkRef = {
  canonicalSource: string;
  externalIds: { source: string; externalId: string }[];
};

function workHref(
  domain: "games" | "books" | "music",
  item: WorkRef,
): string | null {
  const id = canonicalExternalId(item, item.externalIds);
  return id ? `/app/${domain}/${id}` : null;
}

function mediaWork(
  item: WorkRef & { title: string; posterUrl: string | null; type: string },
) {
  const id = canonicalExternalId(item, item.externalIds);
  return {
    title: item.title,
    imageUrl: item.posterUrl,
    href: id ? `/app/media/${item.type.toLowerCase()}/${id}` : null,
  };
}

// A finish (first or replay) says more than a start, so a work both started
// and finished that week shows once, as finished.
function pushTimeline(
  push: (
    domain: StatsDomain,
    work: { title: string; imageUrl: string | null; href: string | null },
    kind: OnThisDayEntryDto["kind"],
    at: Date,
  ) => void,
  domain: StatsDomain,
  work: { title: string; imageUrl: string | null; href: string | null },
  entry: {
    startedAt: Date | null;
    finishedAt: Date | null;
    replays: { finishedAt: Date }[];
  },
  inWindow: (at: Date | null) => at is Date,
) {
  const finished = inWindow(entry.finishedAt)
    ? entry.finishedAt
    : entry.replays[0]?.finishedAt;
  if (finished) push(domain, work, "finished", finished);
  else if (inWindow(entry.startedAt))
    push(domain, work, "started", entry.startedAt);
}
