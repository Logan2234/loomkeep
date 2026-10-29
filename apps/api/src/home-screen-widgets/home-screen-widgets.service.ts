import {
  type CalendarEntryDto,
  Domain,
  ErrorCode,
  type HomeScreenWidgetFeedDto,
  type HomeScreenWidgetReleaseDto,
  type HomeScreenWidgetShowDto,
  type HomeScreenWidgetWatchNextDto,
  type LibraryEntryDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../common/app.exception";
import { LibraryService } from "../library/library.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainGateService } from "../users/domain-gate.service";
import { isSuspended } from "../users/suspension.util";
import { signWidgetToken, verifyWidgetToken } from "./widget-token";

/** The most a 5 × 5 widget shows: 3 × 3 posters. */
const FEED_LENGTH = 9;
/** Shows read to find FEED_LENGTH with an episode left to watch. */
const SHOWS_SCANNED = 50;

const mediaPath = (item: { type: string; sourceId: string }) =>
  `/app/media/${item.type.toLowerCase()}/${item.sourceId}`;

/**
 * What the Android app's home-screen widgets (MOB-20) read and do, outside
 * the WebView: « À suivre » and its button that marks the next episode
 * watched, and « Sorties ».
 */
@Injectable()
export class HomeScreenWidgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly library: LibraryService,
    private readonly domains: DomainGateService,
  ) {}

  token(userId: string, sessionId: string | undefined): { token: string } {
    // Only a browser session can hand its widgets a token: an API key has none.
    if (!sessionId) throw tokenInvalid(HttpStatus.FORBIDDEN);
    return { token: signWidgetToken({ userId, sessionId }) };
  }

  /** The account a widget acts for, while the session that gave it its token lasts. */
  async authenticate(token: string | undefined): Promise<string> {
    const claims = verifyWidgetToken(token ?? "");
    if (!claims) throw tokenInvalid(HttpStatus.UNAUTHORIZED);

    const session = await this.prisma.refreshToken.findFirst({
      where: {
        id: claims.sessionId,
        userId: claims.userId,
        expiresAt: { gt: new Date() },
      },
      select: { user: { select: { suspendedUntil: true } } },
    });

    if (!session || isSuspended(session.user)) {
      throw tokenInvalid(HttpStatus.UNAUTHORIZED);
    }

    return claims.userId;
  }

  async feed(
    userId: string,
    lang?: string,
    acceptLanguage?: string,
  ): Promise<HomeScreenWidgetFeedDto> {
    const [toWatch, calendar] = await Promise.all([
      this.toWatch(userId, lang),
      this.library.getCalendar(userId, acceptLanguage),
    ]);
    return {
      toWatch,
      releases: calendar.slice(0, FEED_LENGTH).map(toRelease),
    };
  }

  /**
   * Marks the episode the widget showed watched, if it's still the show's
   * next one: a widget drawn before the episode was watched elsewhere must
   * not log it twice.
   */
  async watchNext(
    userId: string,
    dto: HomeScreenWidgetWatchNextDto,
  ): Promise<void> {
    const entry = await this.library.getEntry(userId, dto.entryId);
    if (entry.progress?.nextEpisode?.episodeId !== dto.episodeId) return;
    await this.library.watchEpisode(userId, dto.episodeId, {});
  }

  private async toWatch(
    userId: string,
    lang?: string,
  ): Promise<HomeScreenWidgetShowDto[]> {
    const domains = await this.domains.getEnabledDomains(userId);
    if (!domains.includes(Domain.MEDIA)) return [];

    const { items } = await this.library.listEntries(userId, {
      statuses: ["WATCHING"],
      types: ["SERIES", "ANIME"],
      page: 1,
      limit: SHOWS_SCANNED,
      lang,
    });
    return items
      .filter((entry) => entry.progress?.nextEpisode)
      .sort((a, b) => lastActivity(b) - lastActivity(a))
      .slice(0, FEED_LENGTH)
      .map((entry) => ({
        entryId: entry.id,
        title: entry.mediaItem.title,
        posterUrl: entry.mediaItem.posterUrl,
        path: mediaPath(entry.mediaItem),
        next: entry.progress!.nextEpisode!,
        watchedEpisodes: entry.progress!.watchedEpisodes,
        totalEpisodes: entry.progress!.totalEpisodes,
      }));
  }
}

const lastActivity = (entry: LibraryEntryDto) =>
  new Date(entry.lastWatchedAt ?? entry.updatedAt).getTime();

function toRelease(entry: CalendarEntryDto): HomeScreenWidgetReleaseDto {
  const common = {
    seasonNumber: entry.seasonNumber,
    episodeNumber: entry.episodeNumber,
    airDate: entry.airDate,
    releasePrecision: entry.releasePrecision,
  };

  if (entry.game) {
    return {
      ...common,
      kind: "GAME",
      title: entry.game.title,
      posterUrl: entry.game.coverUrl,
      path: `/app/games/${entry.game.sourceId}`,
    };
  }

  const item = entry.mediaItem!;
  return {
    ...common,
    kind: item.type === "MOVIE" ? "MOVIE" : "EPISODE",
    title: item.title,
    posterUrl: item.posterUrl,
    path: mediaPath(item),
  };
}

const tokenInvalid = (status: HttpStatus) =>
  new AppException(status, ErrorCode.HomeScreenWidgetTokenInvalid);
