import type {
  ApiV1Phase,
  ApiV1StatsSummaryDto,
  StatsDomain,
} from "@loomkeep/shared";
import { STATS_DOMAINS, StatsStatusBucket } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { BookLibraryService } from "../../books/book-library.service";
import { StatsService } from "../../stats/stats.service";
import { DomainGateService } from "../../users/domain-gate.service";

// Only the free tier of each stats section is exposed: premium figures stay
// in the app, where they're gated.
const FREE_TIER = false;

@Injectable()
export class StatsV1Service {
  constructor(
    private readonly stats: StatsService,
    private readonly books: BookLibraryService,
    private readonly domainGate: DomainGateService,
  ) {}

  async summary(userId: string): Promise<ApiV1StatsSummaryDto> {
    const enabled = await this.domainGate.getEnabledDomains(userId);
    const has = (domain: StatsDomain) => enabled.includes(domain);
    const year = new Date().getFullYear();

    const [overview, video, games, books, readingGoal, music] =
      await Promise.all([
        this.stats.getOverview(userId, "ALL", FREE_TIER),
        has("MEDIA") ? this.stats.getVideoStats(userId, FREE_TIER) : null,
        has("GAMES") ? this.stats.getGameStats(userId, FREE_TIER) : null,
        has("BOOKS") ? this.stats.getBookStats(userId, FREE_TIER) : null,
        has("BOOKS") ? this.books.getReadingGoal(userId, year) : null,
        has("MUSIC") ? this.stats.getMusicStats(userId, FREE_TIER) : null,
      ]);

    return {
      total: overview.total,
      favorites: overview.favorites,
      averageRating: overview.averageRating,
      domains: overview.breakdowns
        .filter((b) => STATS_DOMAINS.includes(b.domain))
        .map((b) => ({
          domain: b.domain,
          total: b.total,
          favorites: b.favorites,
          byPhase: Object.fromEntries(
            Object.values(StatsStatusBucket).map((phase) => [
              phase,
              b.byStatus.find((s) => s.bucket === phase)?.count ?? 0,
            ]),
          ) as Record<ApiV1Phase, number>,
        })),
      video: video && {
        totalMinutes: video.totalMinutes,
        episodesWatched: video.episodesWatched,
      },
      games: games && { totalPlaytimeMinutes: games.totalPlaytimeMinutes },
      books: books && {
        pagesRead: books.pagesRead,
        readingGoal: readingGoal && readingGoal.target > 0 ? readingGoal : null,
      },
      music: music && { listenDurationMin: music.listenDurationMin },
    };
  }
}
