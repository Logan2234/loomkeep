import type { ActivityEventDto, ActivityFeedTokenDto } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../../common/app.exception";
import {
  type CopyLocale,
  resolveCopyLocale,
} from "../../common/copy-locale.util";
import { randomToken } from "../../common/crypto.util";
import { primaryWebOrigin } from "../../common/web-origin.util";
import { EntitlementService } from "../../entitlements/entitlement.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ActivityService } from "../../social/activity.service";
import { type ReleaseFeed } from "../calendar/feed.util";

/** A feed reader keeps what it already fetched: this only caps one fetch. */
const ACTIVITY_FEED_MAX_ENTRIES = 50;

interface ActivityFeedCopy {
  title: string;
  description: string;
  /** Short verbs for entry titles, by activity type. */
  verbs: Record<string, string>;
  seasonFinished: (season: number, title: string) => string;
  progress: (count: number, title: string) => string;
}

/**
 * Duplicated wording from `apps/web/src/lib/activity-phrase.ts`, which can't
 * be imported here (Paraglide compiles messages for the SvelteKit app only).
 */
const FEED_COPY = {
  fr: {
    title: "Loomkeep · Activité",
    description: "Le journal d'activité public de ce compte.",
    verbs: {
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
    seasonFinished: (season, title) => `Saison ${season} terminée · ${title}`,
    progress: (count, title) => `Épisode(s) vu(s) (${count}) · ${title}`,
  },
  en: {
    title: "Loomkeep · Activity",
    description: "This account's public activity log.",
    verbs: {
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
    seasonFinished: (season, title) => `Season ${season} finished · ${title}`,
    progress: (count, title) => `Episode(s) watched (${count}) · ${title}`,
  },
  it: {
    title: "Loomkeep · Attività",
    description: "Il registro pubblico delle attività di questo account.",
    verbs: {
      ADDED: "Aggiunto",
      STARTED: "Iniziato",
      FINISHED: "Finito",
      DROPPED: "Abbandonato",
      REWATCHED: "Rivisto",
      FAVORITED: "Tra i preferiti",
      REVIEWED: "Votato",
      LIST_CREATED: "Lista creata",
      LIST_ITEM_ADDED: "Aggiunto a una lista",
      LIST_SHARED: "Lista condivisa",
    },
    seasonFinished: (season, title) => `Stagione ${season} finita · ${title}`,
    progress: (count, title) => `Episodi visti (${count}) · ${title}`,
  },
} satisfies Record<CopyLocale, ActivityFeedCopy>;

/** A short, localized entry title, e.g. "Terminé · Breaking Bad". */
function entryTitle(event: ActivityEventDto, copy: ActivityFeedCopy): string {
  if (
    event.type === "SEASON_FINISHED" &&
    typeof event.data.seasonNumber === "number"
  ) {
    return copy.seasonFinished(event.data.seasonNumber, event.title);
  }

  if (event.type === "PROGRESS") {
    return copy.progress(event.count, event.title);
  }

  const verb = copy.verbs[event.type] ?? copy.verbs.FINISHED;
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

    const webOrigin = primaryWebOrigin(this.config.get<string>("WEB_ORIGIN"));
    const copy: ActivityFeedCopy = FEED_COPY[resolveCopyLocale(user.locale)];
    const profileLink = `${webOrigin}/app/u/${user.username}`;

    return {
      id: `urn:loomkeep:activity:${user.id}`,
      title: copy.title,
      description: copy.description,
      link: profileLink,
      entries: timeline.items.map((event) => ({
        id: `urn:loomkeep:activity-event:${event.id}`,
        title: entryTitle(event, copy),
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
    const token = randomToken(24, "base64url");
    await this.prisma.user.update({
      where: { id: userId },
      data: { activityFeedToken: token },
      select: { activityFeedToken: true },
    });
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
