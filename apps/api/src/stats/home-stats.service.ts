import {
  type FiguresDto,
  type MyYearDto,
  type OnThisDayEntryDto,
  type ProfileFiguresDto,
  type StatsDomain,
} from "@loomkeep/shared/contracts";
import { Domain, TrackingCycleStatus } from "@loomkeep/shared/enums";
import { Injectable } from "@nestjs/common";
import {
  CANONICAL_EXTERNAL_ID_SELECT,
  canonicalExternalId,
} from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { DomainGateService } from "../users/domain-gate.service";
import { anniversaryWindow, rankByAnniversary } from "./on-this-day.util";

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

  /**
   * What the user saw, played, read and heard in `year` (UTC calendar year),
   * one block per enabled domain. Game minutes and book pages come from
   * logged sessions only: Steam's playtime has no date to place it in a year.
   */
  async myYear(userId: string, year: number): Promise<MyYearDto> {
    return {
      year,
      ...(await this.summarize(userId, {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      })),
    };
  }

  /**
   * The profile's « En chiffres » (PRV-05): `year` as « Mon année » counts
   * it, and the same figures over the whole library.
   */
  async profileFigures(
    userId: string,
    year: number,
  ): Promise<ProfileFiguresDto> {
    const [thisYear, allTime] = await Promise.all([
      this.myYear(userId, year),
      this.summarize(userId, null),
    ]);
    return { thisYear, allTime };
  }

  /**
   * One block per enabled domain, over `within` or, when null, everything:
   * then a film or an album counts once finished, whatever its date.
   */
  private async summarize(
    userId: string,
    within: { gte: Date; lt: Date } | null,
  ): Promise<FiguresDto> {
    const enabled = await this.domainGate.getEnabledDomains(userId);
    const finished = within ?? { not: null };
    const dated = within ?? undefined;
    const summary: FiguresDto = {};
    const tasks: Promise<void>[] = [];

    if (enabled.includes(Domain.MEDIA)) {
      tasks.push(
        (async () => {
          const [movies, replays, episodes] = await Promise.all([
            this.prisma.mediaEntry.findMany({
              where: {
                userId,
                finishedAt: finished,
                mediaItem: { type: "MOVIE" },
              },
              select: { mediaItem: { select: { runtimeMin: true } } },
            }),
            this.prisma.movieReplay.findMany({
              where: { mediaEntry: { userId }, finishedAt: dated },
              select: {
                mediaEntry: {
                  select: { mediaItem: { select: { runtimeMin: true } } },
                },
              },
            }),
            within
              ? this.prisma.$queryRaw<
                  { count: bigint; minutes: bigint | null }[]
                >`
                  SELECT COUNT(*) AS count, SUM(e."runtimeMin") AS minutes
                  FROM "EpisodeWatch" w JOIN "Episode" e ON e.id = w."episodeId"
                  WHERE w."userId" = ${userId}
                    AND w."watchedAt" >= ${within.gte} AND w."watchedAt" < ${within.lt}`
              : this.prisma.$queryRaw<
                  { count: bigint; minutes: bigint | null }[]
                >`
                  SELECT COUNT(*) AS count, SUM(e."runtimeMin") AS minutes
                  FROM "EpisodeWatch" w JOIN "Episode" e ON e.id = w."episodeId"
                  WHERE w."userId" = ${userId}`,
          ]);
          const movieMinutes =
            movies.reduce((sum, m) => sum + (m.mediaItem.runtimeMin ?? 0), 0) +
            replays.reduce(
              (sum, r) => sum + (r.mediaEntry.mediaItem.runtimeMin ?? 0),
              0,
            );
          summary.video = {
            movies: movies.length + replays.length,
            episodes: Number(episodes[0]?.count ?? 0),
            minutes: movieMinutes + Number(episodes[0]?.minutes ?? 0),
          };
        })(),
      );
    }

    if (enabled.includes(Domain.GAMES)) {
      tasks.push(
        (async () => {
          const [finished, sessions] = await Promise.all([
            this.prisma.gamePlaythrough.count({
              where: {
                gameEntry: { userId },
                status: TrackingCycleStatus.COMPLETED,
                finishedAt: dated,
              },
            }),
            this.prisma.gameSession.aggregate({
              where: { gameEntry: { userId }, occurredAt: dated },
              _sum: { durationMinutes: true },
            }),
          ]);
          summary.games = {
            finished,
            minutes: sessions._sum.durationMinutes ?? 0,
          };
        })(),
      );
    }

    if (enabled.includes(Domain.BOOKS)) {
      tasks.push(
        (async () => {
          const [read, sessions] = await Promise.all([
            this.prisma.bookReading.count({
              where: {
                bookEntry: { userId },
                status: TrackingCycleStatus.COMPLETED,
                finishedAt: dated,
              },
            }),
            this.prisma.bookSession.aggregate({
              where: { bookEntry: { userId }, occurredAt: dated },
              _sum: { pagesRead: true },
            }),
          ]);
          summary.books = { read, pages: sessions._sum.pagesRead ?? 0 };
        })(),
      );
    }

    if (enabled.includes(Domain.MUSIC)) {
      tasks.push(
        (async () => {
          summary.music = {
            listened: await this.prisma.musicEntry.count({
              where: { userId, status: "LISTENED", finishedAt: dated },
            }),
          };
        })(),
      );
    }

    await Promise.all(tasks);
    return summary;
  }

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
                          ...CANONICAL_EXTERNAL_ID_SELECT,
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

          const movies = await this.prisma.mediaEntry.findMany({
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
                  ...CANONICAL_EXTERNAL_ID_SELECT,
                },
              },
            },
          });

          for (const movie of movies) {
            const at = inWindow(movie.finishedAt)
              ? movie.finishedAt
              : movie.replays[0]!.finishedAt;
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
                {
                  playthroughs: {
                    some: {
                      status: TrackingCycleStatus.COMPLETED,
                      finishedAt: within,
                    },
                  },
                },
              ],
            },
            select: {
              startedAt: true,
              finishedAt: true,
              playthroughs: {
                where: {
                  status: TrackingCycleStatus.COMPLETED,
                  finishedAt: within,
                },
                select: { finishedAt: true },
              },
              gameItem: {
                select: {
                  title: true,
                  coverUrl: true,
                  ...CANONICAL_EXTERNAL_ID_SELECT,
                },
              },
            },
          });

          for (const game of games) {
            const work = {
              title: game.gameItem.title,
              imageUrl: game.gameItem.coverUrl,
              href: workHref("games", game.gameItem),
            };
            pushTimeline(
              push,
              Domain.GAMES,
              work,
              { ...game, replays: game.playthroughs },
              inWindow,
            );
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
                {
                  readings: {
                    some: {
                      status: TrackingCycleStatus.COMPLETED,
                      finishedAt: within,
                    },
                  },
                },
              ],
            },
            select: {
              startedAt: true,
              finishedAt: true,
              readings: {
                where: {
                  status: TrackingCycleStatus.COMPLETED,
                  finishedAt: within,
                },
                select: { finishedAt: true },
              },
              bookItem: {
                select: {
                  title: true,
                  coverUrl: true,
                  ...CANONICAL_EXTERNAL_ID_SELECT,
                },
              },
            },
          });

          for (const book of books) {
            const work = {
              title: book.bookItem.title,
              imageUrl: book.bookItem.coverUrl,
              href: workHref("books", book.bookItem),
            };
            pushTimeline(
              push,
              Domain.BOOKS,
              work,
              { ...book, replays: book.readings },
              inWindow,
            );
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
                select: {
                  title: true,
                  coverUrl: true,
                  ...CANONICAL_EXTERNAL_ID_SELECT,
                },
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
    replays: { finishedAt: Date | null }[];
  },
  inWindow: (at: Date | null) => at is Date,
) {
  const finished = inWindow(entry.finishedAt)
    ? entry.finishedAt
    : entry.replays.map(({ finishedAt }) => finishedAt).find(inWindow);
  if (finished) push(domain, work, "finished", finished);
  else if (inWindow(entry.startedAt))
    push(domain, work, "started", entry.startedAt);
}
