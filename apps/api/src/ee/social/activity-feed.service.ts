import type { ActivityEventDto, ActivityFeedTokenDto } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { AppException } from "../../common/app.exception";
import { EntitlementService } from "../../entitlements/entitlement.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ActivityService } from "../../social/activity.service";
import { type ReleaseFeed } from "../calendar/feed.util";

/** A feed reader keeps what it already fetched: this only caps one fetch. */
const ACTIVITY_FEED_MAX_ENTRIES = 50;

const FEED_COPY: Record<string, { title: string; description: string }> = {
  fr: {
    title: "Loomkeep · Activité",
    description: "Le journal d'activité public de ce compte.",
  },
  en: {
    title: "Loomkeep · Activity",
    description: "This account's public activity log.",
  },
};

/**
 * Short verbs for the feed entry titles — duplicated wording from
 * `apps/web/src/lib/activity-phrase.ts`, which can't be imported here
 * (Paraglide compiles messages for the SvelteKit app only). Same
 * duplication trade-off as `FEED_COPY` above and the calendar feed's own
 * copy.
 */
const ACTIVITY_VERBS: Record<string, Record<string, string>> = {
  fr: {
    ADDED: "Ajouté",
    STARTED: "Commencé",
    FINISHED: "Terminé",
    DROPPED: "Abandonné",
    REWATCHED: "Relancé",
    FAVORITED: "Mis en favori",
    REVIEWED: "Noté",
    LIST_CREATED: "Liste créée",
    LIST_ITEM_ADDED: "Ajout à une liste",
    LIST_SHARED: "Liste partagée",
  },
  en: {
    ADDED: "Added",
    STARTED: "Started",
    FINISHED: "Finished",
    DROPPED: "Dropped",
    REWATCHED: "Rewatched",
    FAVORITED: "Favorited",
    REVIEWED: "Rated",
    LIST_CREATED: "List created",
    LIST_ITEM_ADDED: "Added to a list",
    LIST_SHARED: "List shared",
  },
};

/** A short, localized entry title, e.g. "Terminé · Breaking Bad". */
function entryTitle(event: ActivityEventDto, locale: string): string {
  const lang = locale === "fr" ? "fr" : "en";

  if (
    event.type === "SEASON_FINISHED" &&
    typeof event.data.seasonNumber === "number"
  ) {
    return lang === "fr"
      ? `Saison ${event.data.seasonNumber} terminée · ${event.title}`
      : `Season ${event.data.seasonNumber} finished · ${event.title}`;
  }

  if (event.type === "PROGRESS") {
    return lang === "fr"
      ? `Épisode(s) vu(s) (${event.count}) · ${event.title}`
      : `Episode(s) watched (${event.count}) · ${event.title}`;
  }

  const verb =
    ACTIVITY_VERBS[lang][event.type] ?? ACTIVITY_VERBS[lang].FINISHED;
  return `${verb} · ${event.title}`;
}

/**
 * The account's own activity timeline as an Atom feed, fed through an
 * unguessable per-user token so feed readers can poll it without signing
 * in — same pattern as the calendar feed (ee/calendar). Premium
 * (docs/adr/0001-open-core-agpl.md).
 */
@Injectable()
export class ActivityFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService,
  ) {}

  /** The feed for the account holding `token`, or null if none does. */
  async getFeed(token: string): Promise<ReleaseFeed | null> {
    const user = await this.premiumUserForToken(token);
    if (!user) return null;

    // Called as the owner viewing their own timeline: `filterVisible`
    // short-circuits every facet check on `relation.isSelf`, so this reads
    // as literally everything ever emitted for the account — same content
    // already shown on their own profile page's Activité tab.
    const timeline = await this.activity.profileTimeline(
      user.id,
      { id: user.id, profileAccess: user.profileAccess },
      1,
      ACTIVITY_FEED_MAX_ENTRIES,
    );

    const webOrigin = (this.config.get<string>("WEB_ORIGIN") ?? "")
      .split(",")[0]
      .trim();
    const copy = FEED_COPY[user.locale] ?? FEED_COPY.en;
    const profileLink = `${webOrigin}/app/u/${user.username}`;

    return {
      id: `urn:loomkeep:activity:${user.id}`,
      title: copy.title,
      description: copy.description,
      link: profileLink,
      entries: timeline.items.map((event) => ({
        id: `urn:loomkeep:activity-event:${event.id}`,
        title: entryTitle(event, user.locale),
        link: event.href ? `${webOrigin}${event.href}` : profileLink,
        airDate: new Date(event.createdAt),
      })),
    };
  }

  /**
   * The premium check is repeated on every fetch, not just at token
   * issuance, so a downgraded account's feed reader stops getting fed the
   * moment its plan changes, instead of forever on a token minted while
   * premium.
   */
  private async premiumUserForToken(token: string): Promise<{
    id: string;
    username: string;
    locale: string;
    profileAccess: string;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { activityFeedToken: token },
      select: {
        id: true,
        username: true,
        locale: true,
        profileAccess: true,
      },
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
  async getToken(userId: string): Promise<ActivityFeedTokenDto> {
    await this.requirePremium(userId);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { activityFeedToken: true },
    });

    if (user.activityFeedToken) {
      return { token: user.activityFeedToken };
    }

    return this.issueToken(userId);
  }

  async regenerateToken(userId: string): Promise<ActivityFeedTokenDto> {
    await this.requirePremium(userId);
    return this.issueToken(userId);
  }

  private async issueToken(userId: string): Promise<ActivityFeedTokenDto> {
    const { activityFeedToken } = await this.prisma.user.update({
      where: { id: userId },
      data: { activityFeedToken: randomBytes(24).toString("base64url") },
      select: { activityFeedToken: true },
    });
    return { token: activityFeedToken! };
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
