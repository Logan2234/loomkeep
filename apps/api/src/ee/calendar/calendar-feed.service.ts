import type { CalendarTokenDto } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { AppException } from "../../common/app.exception";
import { canonicalExternalId } from "../../common/external-id.util";
import { EntitlementService } from "../../entitlements/entitlement.service";
import { LibraryService } from "../../library/library.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { ReleaseFeed } from "./feed.util";
import { buildCalendarIcs } from "./ics.util";

/** How far back the release feed looks, in days. */
const RELEASES_WINDOW_DAYS = 30;

/** A feed reader keeps what it already fetched: this only caps one fetch. */
const RELEASES_MAX_ENTRIES = 100;

const FEED_COPY: Record<string, { title: string; description: string }> = {
  fr: {
    title: "Loomkeep · Épisodes sortis",
    description: "Les derniers épisodes sortis des séries que tu suis.",
  },
  en: {
    title: "Loomkeep · New episodes",
    description: "The latest episodes of the shows you follow.",
  },
};

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
    private readonly library: LibraryService,
    private readonly config: ConfigService,
  ) {}

  /** The calendar for the account holding `token`, or null if none does. */
  async getCalendarIcs(token: string): Promise<string | null> {
    const user = await this.premiumUserForToken(token);
    return user
      ? buildCalendarIcs(await this.library.getCalendar(user.id))
      : null;
  }

  /**
   * The episodes aired over the last month for the shows the account holding
   * `token` follows (dropped ones excluded, like the calendar), newest first.
   */
  async getReleasesFeed(
    token: string,
    now = new Date(),
  ): Promise<ReleaseFeed | null> {
    const user = await this.premiumUserForToken(token);
    if (!user) return null;

    const since = new Date(now.getTime() - RELEASES_WINDOW_DAYS * 86_400_000);
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

    const webOrigin = (this.config.get<string>("WEB_ORIGIN") ?? "")
      .split(",")[0]
      .trim();
    const copy = FEED_COPY[user.locale] ?? FEED_COPY.en;

    return {
      id: `urn:loomkeep:releases:${user.id}`,
      title: copy.title,
      description: copy.description,
      link: `${webOrigin}/app/calendar`,
      entries: episodes.map((episode) => {
        const item = episode.season.mediaItem;
        const code = `S${pad(episode.season.number)}E${pad(episode.number)}`;

        return {
          id: `urn:loomkeep:episode:${episode.id}`,
          title: [`${item.title} — ${code}`, episode.title]
            .filter(Boolean)
            .join(" · "),
          link: `${webOrigin}/app/media/${item.type.toLowerCase()}/${canonicalExternalId(item, item.externalIds)}`,
          // airDate is guaranteed non-null by the range filter above.
          airDate: episode.airDate!,
        };
      }),
    };
  }

  /**
   * The premium check is repeated on every fetch, not just at token issuance,
   * so a downgraded account's calendar app or feed reader stops getting fed
   * the moment its plan changes, instead of forever on a token minted while
   * premium.
   */
  private async premiumUserForToken(
    token: string,
  ): Promise<{ id: string; locale: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { calendarToken: token },
      select: { id: true, locale: true },
    });

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

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { calendarToken: true },
    });

    if (user.calendarToken) {
      return { token: user.calendarToken };
    }

    return this.issueToken(userId);
  }

  async regenerateToken(userId: string): Promise<CalendarTokenDto> {
    await this.requirePremium(userId);
    return this.issueToken(userId);
  }

  private async issueToken(userId: string): Promise<CalendarTokenDto> {
    const { calendarToken } = await this.prisma.user.update({
      where: { id: userId },
      data: { calendarToken: randomBytes(24).toString("base64url") },
      select: { calendarToken: true },
    });
    return { token: calendarToken! };
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

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
