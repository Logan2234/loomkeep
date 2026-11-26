import type { CalendarTokenDto } from "@loomkeep/shared";
import {
  episodeCode,
  ErrorCode,
  gameReleaseAlertDay,
  movieReleaseDates,
  movieReleaseInfo,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TmdbProvider } from "../../catalog/providers/tmdb.provider";
import { resolveWatchRegion } from "../../catalog/watch-region.util";
import { AppException } from "../../common/app.exception";
import {
  type CopyLocale,
  resolveCopyLocale,
} from "../../common/copy-locale.util";
import { randomToken } from "../../common/crypto.util";
import { sinceDaysAgo, utcDateKey } from "../../common/date.util";
import { canonicalExternalId } from "../../common/external-id.util";
import { primaryWebOrigin } from "../../common/web-origin.util";
import { EntitlementService } from "../../entitlements/entitlement.service";
import { CalendarService } from "../../library/calendar.service";
import { notificationCopy } from "../../notifications/notification-copy";
import { PrismaService } from "../../prisma/prisma.service";
import { saveUserUrlToken } from "../../users/user-url-token.writer";
import type { ReleaseFeed, ReleaseFeedEntry } from "./feed.util";
import { buildCalendarIcs, buildPremieresIcs } from "./ics.util";

/** How far back the release feed looks, in days. */
const RELEASES_WINDOW_DAYS = 30;

/** A feed reader keeps what it already fetched: this only caps one fetch. */
const RELEASES_MAX_ENTRIES = 100;

const FEED_COPY = {
  fr: {
    title: "Loomkeep · Sorties",
    description:
      "Les derniers épisodes, films et jeux sortis de ce que tu suis.",
  },
  en: {
    title: "Loomkeep · New releases",
    description:
      "The latest episodes, movies and games out among what you follow.",
  },
  it: {
    title: "Loomkeep · Uscite",
    description: "Gli ultimi episodi, film e giochi usciti tra ciò che segui.",
  },
} satisfies Record<CopyLocale, { title: string; description: string }>;

const PREMIERES_CALENDAR_NAME = {
  fr: "Loomkeep · Premières",
  en: "Loomkeep · Premieres",
  it: "Loomkeep · Prime visioni",
} satisfies Record<CopyLocale, string>;

/**
 * The release calendar as an `.ics` subscription, and the episodes already
 * out as an RSS/Atom feed, both fed through the same per-user token so
 * calendar apps and feed readers can poll them without signing in. Premium
 * (docs/adr/0001-open-core-agpl.md).
 */
@Injectable()
export class CalendarFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
    private readonly calendar: CalendarService,
    private readonly config: ConfigService,
    private readonly tmdb: TmdbProvider,
  ) {}

  /** The calendar for the account holding `token`, or null if none does. */
  async getCalendarIcs(token: string): Promise<string | null> {
    const user = await this.premiumUserForToken(token);
    return user
      ? buildCalendarIcs(await this.calendar.getCalendar(user.id))
      : null;
  }

  /**
   * The series premiering over the next eight weeks, as the calendar's
   * Premieres tab lists them, in the language of the account holding `token`.
   */
  async getPremieresIcs(token: string): Promise<string | null> {
    const user = await this.premiumUserForToken(token);
    if (!user) return null;

    const locale = resolveCopyLocale(user.locale);
    return buildPremieresIcs(await this.tmdb.listPremieres(locale), {
      name: PREMIERES_CALENDAR_NAME[locale],
      webOrigin: primaryWebOrigin(this.config.get<string>("WEB_ORIGIN")),
    });
  }

  /**
   * What came out over the last month among what the account holding `token`
   * tracks (dropped ones excluded, like the calendar), newest first: aired
   * episodes, local movie releases and game releases.
   */
  async getReleasesFeed(
    token: string,
    now = new Date(),
  ): Promise<ReleaseFeed | null> {
    const user = await this.premiumUserForToken(token);
    if (!user) return null;

    const since = sinceDaysAgo(now, RELEASES_WINDOW_DAYS);
    const episodes = await this.prisma.episode.findMany({
      where: {
        airDate: { gte: since, lte: now },
        season: {
          mediaItem: {
            entries: { some: { userId: user.id, status: { not: "DROPPED" } } },
          },
        },
      },
      orderBy: { airDate: "desc" },
      take: RELEASES_MAX_ENTRIES,
      include: {
        season: {
          include: { mediaItem: { include: { externalIds: true } } },
        },
      },
    });

    const webOrigin = primaryWebOrigin(this.config.get<string>("WEB_ORIGIN"));
    const copy = FEED_COPY[resolveCopyLocale(user.locale)];

    const episodeEntries: ReleaseFeedEntry[] = episodes.map((episode) => {
      const item = episode.season.mediaItem;
      const code = episodeCode(episode.season.number, episode.number);

      return {
        id: `urn:loomkeep:episode:${episode.id}`,
        title: [`${item.title} — ${code}`, episode.title]
          .filter(Boolean)
          .join(" · "),
        link: `${webOrigin}/app/media/${item.type.toLowerCase()}/${canonicalExternalId(item, item.externalIds)}`,
        // airDate is guaranteed non-null by the range filter above.
        airDate: episode.airDate!,
      };
    });
    const entries = [
      ...episodeEntries,
      ...(await this.movieReleases(user, since, now, webOrigin)),
      ...(await this.gameReleases(user, since, now, webOrigin)),
    ]
      .sort((a, b) => b.airDate.getTime() - a.airDate.getTime())
      .slice(0, RELEASES_MAX_ENTRIES);

    return {
      id: `urn:loomkeep:releases:${user.id}`,
      title: copy.title,
      description: copy.description,
      link: `${webOrigin}/app/calendar`,
      entries,
    };
  }

  /** Tracked movies whose local release fell in the window, as on the calendar. */
  private async movieReleases(
    user: FeedUser,
    since: Date,
    now: Date,
    webOrigin: string,
  ): Promise<ReleaseFeedEntry[]> {
    const entries = await this.prisma.mediaEntry.findMany({
      where: {
        userId: user.id,
        status: { not: "DROPPED" },
        mediaItem: { type: "MOVIE" },
      },
      include: { mediaItem: { include: { externalIds: true } } },
    });
    const from = utcDateKey(since);
    const to = utcDateKey(now);

    return entries.flatMap((entry) => {
      const region = resolveWatchRegion(
        user.watchRegion ?? entry.movieReleaseRegion ?? undefined,
        undefined,
      );
      const release = movieReleaseInfo(
        movieReleaseDates(entry.mediaItem.movieReleaseDates),
        entry.mediaItem.status,
        region,
        now,
      );
      if (
        !release.localDate ||
        !release.localType ||
        release.localDate < from ||
        release.localDate > to
      )
        return [];
      const item = entry.mediaItem;
      return [
        {
          id: `urn:loomkeep:movie:${item.id}:${region}`,
          title: `${item.title} — ${notificationCopy(user.locale).movieRelease(release.localType, region)}`,
          link: `${webOrigin}/app/media/movie/${canonicalExternalId(item, item.externalIds)}`,
          airDate: new Date(`${release.localDate}T00:00:00.000Z`),
        },
      ];
    });
  }

  /**
   * Tracked games out in the window, dated to their day — or the 1st, for a
   * month — like the calendar. A vaguer date never pins a release down.
   */
  private async gameReleases(
    user: FeedUser,
    since: Date,
    now: Date,
    webOrigin: string,
  ): Promise<ReleaseFeedEntry[]> {
    const entries = await this.prisma.gameEntry.findMany({
      where: {
        userId: user.id,
        status: { not: "DROPPED" },
        gameItem: {
          releaseDatePrecision: { in: ["DAY", "MONTH"] },
          releaseDate: { gte: since, lte: now },
        },
      },
      include: { gameItem: { include: { externalIds: true } } },
    });

    return entries.flatMap(({ gameItem: item }) => {
      const day = gameReleaseAlertDay(
        item.releaseDate ? utcDateKey(item.releaseDate) : null,
        item.releaseDatePrecision,
      );
      if (!day) return [];
      return [
        {
          id: `urn:loomkeep:game:${item.id}`,
          title: `${item.title} — ${notificationCopy(user.locale).gameRelease(false)}`,
          link: `${webOrigin}/app/games/${canonicalExternalId(item, item.externalIds)}`,
          airDate: new Date(`${day}T00:00:00.000Z`),
        },
      ];
    });
  }

  /**
   * The premium check is repeated on every fetch, not just at token issuance,
   * so a downgraded account's calendar app or feed reader stops getting fed
   * the moment its plan changes, instead of forever on a token minted while
   * premium.
   */
  private async premiumUserForToken(token: string): Promise<FeedUser | null> {
    const row = await this.prisma.userUrlToken.findUnique({
      where: { calendarToken: token },
      select: {
        user: {
          select: {
            id: true,
            locale: true,
            preferences: { select: { watchRegion: true } },
          },
        },
      },
    });
    const user = row?.user && {
      id: row.user.id,
      locale: row.user.locale,
      watchRegion: row.user.preferences?.watchRegion ?? null,
    };

    if (!user || !(await this.entitlements.isEffectivelyPremium(user.id))) {
      return null;
    }

    return user;
  }

  /**
   * The subscription token, generated on first call and stable afterwards —
   * `regenerateToken` revokes a previously shared link.
   */
  async getToken(userId: string): Promise<CalendarTokenDto> {
    await this.requirePremium(userId);

    const row = await this.prisma.userUrlToken.findUnique({
      where: { userId },
      select: { calendarToken: true },
    });

    if (row?.calendarToken) {
      return { token: row.calendarToken };
    }

    return this.issueToken(userId);
  }

  async regenerateToken(userId: string): Promise<CalendarTokenDto> {
    await this.requirePremium(userId);
    return this.issueToken(userId);
  }

  private async issueToken(userId: string): Promise<CalendarTokenDto> {
    const token = randomToken(24, "base64url");
    await saveUserUrlToken(this.prisma, userId, "calendarToken", token);
    return { token };
  }

  private async requirePremium(userId: string): Promise<void> {
    if (!(await this.entitlements.isEffectivelyPremium(userId))) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.UserPremiumRequired,
        undefined,
        "This feature is reserved for premium accounts",
      );
    }
  }
}

interface FeedUser {
  id: string;
  locale: string;
  watchRegion: string | null;
}
