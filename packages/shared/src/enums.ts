// String-literal const objects instead of TS enums: same ergonomics,
// but the values survive as plain strings across the API boundary.

/**
 * Top-level content domain a user can compose their app from. MEDIA groups
 * MOVIE/SERIES/ANIME; BOOKS and GAMES have their own screens (search, library,
 * stats, imports). `User.enabledDomains` records which ones the user keeps
 * visible — the nav filters on it today (see web `isDomainEnabled`); search
 * and notification filtering still follow.
 *
 * MUSIC, PODCASTS and BOARDGAMES (board games — distinct from GAMES, i.e.
 * video games) are parked placeholders: they surface as "coming soon" and
 * are excluded from operational routes. Existing Music data is deliberately
 * retained until the domain resumes.
 */
export const Domain = {
  MEDIA: "MEDIA",
  BOOKS: "BOOKS",
  GAMES: "GAMES",
  MUSIC: "MUSIC",
  PODCASTS: "PODCASTS",
  BOARDGAMES: "BOARDGAMES",
} as const;
export type Domain = (typeof Domain)[keyof typeof Domain];

/**
 * Domains announced in the interface but deliberately unavailable until their
 * catalogue and library experiences are ready. Their persisted data remains
 * intact so an unfinished domain can be resumed without a migration.
 */
export const COMING_SOON_DOMAINS: readonly Domain[] = [
  Domain.MUSIC,
  Domain.PODCASTS,
  Domain.BOARDGAMES,
];

export const isComingSoonDomain = (domain: Domain): boolean =>
  COMING_SOON_DOMAINS.includes(domain);

/**
 * Early-access domains, gated behind premium regardless of the user's own
 * `enabledDomains` toggle — see docs/adr/0001-open-core-agpl.md. Shared so
 * the API (DomainGateService, server-side enforcement) and the web (settings
 * UI lock/tooltip) agree on the same list.
 */
export const PREMIUM_DOMAINS: readonly Domain[] = [
  Domain.MUSIC,
  Domain.PODCASTS,
  Domain.BOARDGAMES,
];

/**
 * Operational permission level, orthogonal to `UserEntitlement` (the paid-tier
 * seam, see docs/adr/0001-open-core-agpl.md). A single self-host admin today;
 * `ADMIN` is granted via the `ADMIN_EMAIL` bootstrap or the admin panel, never
 * by plan value.
 */
export const Role = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * Paid tier, mirrors Prisma's `Plan` enum on `UserEntitlement.plan` (see
 * docs/adr/0001-open-core-agpl.md). Set today only by an admin from the
 * user panel or directly in the database — no billing wired up yet.
 */
export const Plan = {
  FREE: "FREE",
  PREMIUM: "PREMIUM",
} as const;
export type Plan = (typeof Plan)[keyof typeof Plan];

/**
 * How often a user wants the "new episode" digest delivered on a given
 * channel (email/push, configured independently). `DAILY` requires
 * effective premium (see `EntitlementService.isEffectivelyPremium`) — a
 * downgraded/non-premium account is served at `WEEKLY` cadence instead of
 * losing the content, never silently switched back to `DISABLED`.
 */
export const DigestCadence = {
  DISABLED: "DISABLED",
  WEEKLY: "WEEKLY",
  DAILY: "DAILY",
} as const;
export type DigestCadence = (typeof DigestCadence)[keyof typeof DigestCadence];

/**
 * In-app notification kinds. Stored as a plain string on `Notification.type`
 * (new kinds need no migration); this list is the shared vocabulary the API
 * emits and the web renders.
 */
export const NotificationType = {
  NEW_EPISODE: "NEW_EPISODE",
  /** Someone started following you (public profile). */
  FOLLOW: "FOLLOW",
  /** Someone asked to follow your private profile. */
  FOLLOW_REQUEST: "FOLLOW_REQUEST",
  FOLLOW_ACCEPTED: "FOLLOW_ACCEPTED",
  COMMENT_REPLY: "COMMENT_REPLY",
  COMMENT_MENTION: "COMMENT_MENTION",
  /** Your comment crossed the reaction notification threshold. */
  COMMENT_REACTIONS: "COMMENT_REACTIONS",
  /** Someone added you as an editor on one of their lists. */
  LIST_MEMBER_ADDED: "LIST_MEMBER_ADDED",
  /** A moderation decision (content removal) was taken against you — see ModerationDecision. */
  MODERATION_ACTION: "MODERATION_ACTION",
  /** DSA art. 16(5): a report you filed has been resolved or dismissed. */
  REPORT_RESOLVED: "REPORT_RESOLVED",
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

/**
 * Activity-feed event kinds (P4). Stored as a plain string on
 * `ActivityEvent.type`. Which ones reach the home feed vs a profile timeline is
 * decided at emit time (the `homeFeed` flag), per the feed matrix.
 */
export const ActivityType = {
  ADDED: "ADDED",
  /** Started watching/playing/reading/listening. */
  STARTED: "STARTED",
  FINISHED: "FINISHED",
  DROPPED: "DROPPED",
  /** Started a rewatch/replay/reread. */
  REWATCHED: "REWATCHED",
  /** Watched an episode / made reading or play progress. */
  PROGRESS: "PROGRESS",
  FAVORITED: "FAVORITED",
  /** Published or updated a review. */
  REVIEWED: "REVIEWED",
  LIST_CREATED: "LIST_CREATED",
  /** Added one or more works to a list. */
  LIST_ITEM_ADDED: "LIST_ITEM_ADDED",
  /** A list's visibility moved from PRIVATE to FRIENDS/PUBLIC. */
  LIST_SHARED: "LIST_SHARED",
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

/** Kind of media. MOVIE/SERIES come from TMDB, ANIME from AniList. */
export const MediaType = {
  MOVIE: "MOVIE",
  SERIES: "SERIES",
  ANIME: "ANIME",
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

/**
 * External catalogue a media or an ID comes from.
 * TMDB and ANILIST are canonical (we fetch from them); TVDB and IMDB are
 * secondary identifiers kept for reconciliation (e.g. TV Time import).
 */
export const MediaSource = {
  TMDB: "TMDB",
  ANILIST: "ANILIST",
  TVDB: "TVDB",
  IMDB: "IMDB",
} as const;
export type MediaSource = (typeof MediaSource)[keyof typeof MediaSource];

/** Sources the catalogue can be queried from (canonical only). */
export const CatalogSource = {
  TMDB: MediaSource.TMDB,
  ANILIST: MediaSource.ANILIST,
} as const;
export type CatalogSource = (typeof CatalogSource)[keyof typeof CatalogSource];

/** Source a game's catalogue data comes from. IGDB is the only one today. */
export const GameSource = {
  IGDB: "IGDB",
} as const;
export type GameSource = (typeof GameSource)[keyof typeof GameSource];

/**
 * Status of a game in a user's library. Unlike media (whose status is derived
 * from episode progress), a game's status is entirely user-set: there is no
 * per-episode progress to infer "playing" or "completed" from. BACKLOG doubles
 * as the wishlist ("want to play").
 */
export const GameStatus = {
  BACKLOG: "BACKLOG",
  PLAYING: "PLAYING",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

/**
 * How the user holds a game, if at all. NONE (default, unset) is the vast
 * majority of entries — this is opt-in. DIGITAL/SUBSCRIPTION pair with a
 * free-form `ownershipSource` (e.g. "Steam", "Xbox Game Pass").
 */
export const GameOwnershipStatus = {
  NONE: "NONE",
  PHYSICAL: "PHYSICAL",
  DIGITAL: "DIGITAL",
  SUBSCRIPTION: "SUBSCRIPTION",
  BORROWED: "BORROWED",
} as const;
export type GameOwnershipStatus =
  (typeof GameOwnershipStatus)[keyof typeof GameOwnershipStatus];

/** Source a book's catalogue data comes from. Open Library only. */
export const BookSource = {
  OPEN_LIBRARY: "OPEN_LIBRARY",
} as const;
export type BookSource = (typeof BookSource)[keyof typeof BookSource];

/**
 * Status of a book in a user's library. Like GameStatus it is entirely
 * user-set: books have no per-chapter progress to derive "reading"/"read" from
 * (page progress is tracked separately, on the entry). TO_READ doubles as the
 * wishlist ("want to read").
 */
export const BookStatus = {
  TO_READ: "TO_READ",
  READING: "READING",
  READ: "READ",
  DROPPED: "DROPPED",
} as const;
export type BookStatus = (typeof BookStatus)[keyof typeof BookStatus];

/**
 * How the user holds a book, if at all. NONE (default, unset) is the vast
 * majority of entries — this is opt-in. DIGITAL/AUDIO pair with a free-form
 * `ownershipSource` (e.g. "Kindle", "Audible").
 */
export const BookOwnershipStatus = {
  NONE: "NONE",
  PHYSICAL: "PHYSICAL",
  DIGITAL: "DIGITAL",
  AUDIO: "AUDIO",
  BORROWED: "BORROWED",
} as const;
export type BookOwnershipStatus =
  (typeof BookOwnershipStatus)[keyof typeof BookOwnershipStatus];

/**
 * Status of a media in a user's library. PLANNED doubles as the watchlist.
 *
 * DROPPED is the only user-set status (a manual "I quit, won't return"
 * override); the others are derived at read time from watch progress + airing
 * status (see `LibraryService.deriveStatus`). UP_TO_DATE ("caught up") applies
 * to series/anime that are fully watched but still airing — it is never
 * persisted. A WATCHING entry left untouched for a while reads as "dormant"
 * (see `isDormant`), a derived signal — not a status.
 */
export const EntryStatus = {
  WATCHING: "WATCHING",
  COMPLETED: "COMPLETED",
  PLANNED: "PLANNED",
  DROPPED: "DROPPED",
  UP_TO_DATE: "UP_TO_DATE",
} as const;
export type EntryStatus = (typeof EntryStatus)[keyof typeof EntryStatus];

/**
 * How the user holds a movie/series/anime, if at all. NONE (default, unset)
 * is the vast majority of entries — this is opt-in. DIGITAL/STREAMING pair
 * with a free-form `ownershipSource` (e.g. "Apple TV", "Netflix").
 */
export const MediaOwnershipStatus = {
  NONE: "NONE",
  PHYSICAL: "PHYSICAL",
  DIGITAL: "DIGITAL",
  STREAMING: "STREAMING",
  BORROWED: "BORROWED",
} as const;
export type MediaOwnershipStatus =
  (typeof MediaOwnershipStatus)[keyof typeof MediaOwnershipStatus];

/** Source a music item's catalogue data comes from. MusicBrainz only. */
export const MusicSource = {
  MUSICBRAINZ: "MUSICBRAINZ",
} as const;
export type MusicSource = (typeof MusicSource)[keyof typeof MusicSource];

/**
 * Status of an album in a user's library. Deliberately binary (unlike
 * GameStatus/BookStatus): an album listen is a short, single-session event,
 * so there is no "in progress" or "dropped" state — just whether it's been
 * heard. TO_LISTEN doubles as the wishlist.
 */
export const MusicStatus = {
  TO_LISTEN: "TO_LISTEN",
  LISTENED: "LISTENED",
} as const;
export type MusicStatus = (typeof MusicStatus)[keyof typeof MusicStatus];

/**
 * How the user holds an album, if at all. NONE (default, unset) is the vast
 * majority of entries — this is opt-in. DIGITAL/STREAMING pair with a
 * free-form `ownershipSource` (e.g. "Bandcamp", "Spotify").
 */
export const MusicOwnershipStatus = {
  NONE: "NONE",
  PHYSICAL: "PHYSICAL",
  DIGITAL: "DIGITAL",
  STREAMING: "STREAMING",
  BORROWED: "BORROWED",
} as const;
export type MusicOwnershipStatus =
  (typeof MusicOwnershipStatus)[keyof typeof MusicOwnershipStatus];

/**
 * Kind of sensitive account action tracked on the admin "Sécurité" page.
 * LOGIN_FAILED is included alongside the account-lifecycle/credential events
 * because the instance can be exposed to the internet — a spike of failed
 * logins is the one signal that actually matters there.
 */
export const SecurityEventType = {
  USER_REGISTERED: "USER_REGISTERED",
  USER_DELETED: "USER_DELETED",
  EMAIL_CHANGED: "EMAIL_CHANGED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_RESET: "PASSWORD_RESET",
  LOGIN_FAILED: "LOGIN_FAILED",
  NEW_DEVICE_LOGIN: "NEW_DEVICE_LOGIN",
} as const;
export type SecurityEventType =
  (typeof SecurityEventType)[keyof typeof SecurityEventType];

// ---------------------------------------------------------------------------
// Social (P4). All of it is gated behind the runtime `SOCIAL_ENABLED` flag.
// ---------------------------------------------------------------------------

/**
 * How reachable a user's profile is — the "authentication" layer of visibility.
 * Acts as a cap over the per-facet audience settings (see VisibilityAudience):
 * a PRIVATE profile can never expose anything as PUBLIC.
 * - PUBLIC:  anyone can reach the profile and follow it (asymmetric).
 * - PRIVATE: content is reachable only through an accepted (reciprocal) follow.
 * - GHOST ("Figurant"): unfindable, unfollowable, activity private. The user can
 *   still consume/participate anonymously (follow public profiles, comment,
 *   react, review under a per-thread pseudonym) but is never exposed.
 */
export const ProfileAccess = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
  GHOST: "GHOST",
} as const;
export type ProfileAccess = (typeof ProfileAccess)[keyof typeof ProfileAccess];

/**
 * Who may see a given passive-content facet — the "authorization" layer.
 * Ordered NONE < FRIENDS < PUBLIC; the effective audience is capped by
 * ProfileAccess (a PRIVATE profile tops out at FRIENDS).
 */
export const VisibilityAudience = {
  PUBLIC: "PUBLIC",
  FRIENDS: "FRIENDS",
  NONE: "NONE",
} as const;
export type VisibilityAudience =
  (typeof VisibilityAudience)[keyof typeof VisibilityAudience];

/**
 * The passive-content facets whose visibility a user tunes per domain. Kept
 * deliberately coarse (2 facets) to keep the privacy screen legible; can be
 * split later without breaking the model.
 * - LIBRARY:  presence + status + progress + favorites for that domain.
 * - ACTIVITY: appearance in the activity feed for that domain.
 * Published content (reviews, comments) is NOT a facet — reviews carry their
 * own explicit scope, comments are public by nature.
 */
export const VisibilityFacet = {
  LIBRARY: "LIBRARY",
  ACTIVITY: "ACTIVITY",
} as const;
export type VisibilityFacet =
  (typeof VisibilityFacet)[keyof typeof VisibilityFacet];

/**
 * State of a directed follow. A follow of a PUBLIC profile is ACCEPTED at once;
 * a follow of a PRIVATE profile is PENDING until the followee approves it.
 */
export const FollowStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
} as const;
export type FollowStatus = (typeof FollowStatus)[keyof typeof FollowStatus];

/**
 * What a review targets. A review carries a mandatory /10 rating + optional
 * text. Works span the four domains; SEASON/EPISODE add finer media levels.
 */
export const ReviewTargetType = {
  MEDIA: "MEDIA",
  SEASON: "SEASON",
  EPISODE: "EPISODE",
  GAME: "GAME",
  BOOK: "BOOK",
  MUSIC: "MUSIC",
} as const;
export type ReviewTargetType =
  (typeof ReviewTargetType)[keyof typeof ReviewTargetType];

/**
 * A review's own audience, chosen at publication (there is no PRIVATE — a
 * review is at least FRIENDS). The effect is only felt when social is enabled;
 * self-host keeps rating locally with nothing exposed. Reading others' reviews
 * and this audience are gated by the social flag.
 */
export const ReviewVisibility = {
  FRIENDS: "FRIENDS",
  PUBLIC: "PUBLIC",
} as const;
export type ReviewVisibility =
  (typeof ReviewVisibility)[keyof typeof ReviewVisibility];

/** Max length of a review's optional text (frontend + backend DTO). */
export const REVIEW_TEXT_MAX_LENGTH = 2000;

/**
 * A vote cast on someone else's review — Reddit-style, one active vote per
 * (user, review). Never shown attributed to a voter; only the aggregate
 * score and the viewer's own vote are ever surfaced.
 */
export const ReviewVoteValue = {
  UP: "UP",
  DOWN: "DOWN",
} as const;
export type ReviewVoteValue =
  (typeof ReviewVoteValue)[keyof typeof ReviewVoteValue];

/**
 * What a comment thread targets. Same shape as ReviewTargetType — a comment
 * lives under a work or one of its seasons/episodes, each a distinct thread.
 */
export const CommentTargetType = {
  MEDIA: "MEDIA",
  SEASON: "SEASON",
  EPISODE: "EPISODE",
  GAME: "GAME",
  BOOK: "BOOK",
  MUSIC: "MUSIC",
} as const;
export type CommentTargetType =
  (typeof CommentTargetType)[keyof typeof CommentTargetType];

/** Fixed reaction set for comments (a full emoji picker is backlog). */
export const CommentEmote = {
  LIKE: "LIKE",
  LOVE: "LOVE",
  LAUGH: "LAUGH",
  WOW: "WOW",
  SAD: "SAD",
  DISLIKE: "DISLIKE",
} as const;
export type CommentEmote = (typeof CommentEmote)[keyof typeof CommentEmote];

/** Display glyph for each CommentEmote, in a fixed picker order. */
export const COMMENT_EMOTE_DISPLAY: Record<CommentEmote, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  LAUGH: "😂",
  WOW: "😮",
  SAD: "😢",
  DISLIKE: "👎",
};

/** Max length of a comment's text (frontend + backend DTO). */
export const COMMENT_TEXT_MAX_LENGTH = 500;

/** How many reactions on one comment trigger the aggregated notification. */
export const COMMENT_REACTION_NOTIFY_THRESHOLD = 10;

/**
 * What a report targets. COMMENT is the only kind produced today; REVIEW/USER
 * are modelled now so reporting a review or a profile later needs no
 * migration, just a new emitter.
 */
export const ReportTargetType = {
  COMMENT: "COMMENT",
  REVIEW: "REVIEW",
  USER: "USER",
  LIST: "LIST",
} as const;
export type ReportTargetType =
  (typeof ReportTargetType)[keyof typeof ReportTargetType];

/** Lifecycle of a report in the admin moderation queue. */
export const ReportStatus = {
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

/**
 * The two restrictive measures actually implemented (see ModerationDecision
 * and CGU §9) — comment removal and admin account deletion. Keep this in
 * lockstep with what the CGU list: DSA art. 14 requires the CGU to describe
 * exactly what the code can do, not more.
 */
export const ModerationMeasure = {
  COMMENT_REMOVED: "COMMENT_REMOVED",
  ACCOUNT_DELETED: "ACCOUNT_DELETED",
} as const;
export type ModerationMeasure =
  (typeof ModerationMeasure)[keyof typeof ModerationMeasure];

/**
 * DSA art. 17(3)(d): whether the measure is grounded in the content's
 * alleged illegality (point a) or in a breach of the CGU (point b).
 */
export const ModerationLegalBasis = {
  ILLEGAL_CONTENT: "ILLEGAL_CONTENT",
  TOS_BREACH: "TOS_BREACH",
} as const;
export type ModerationLegalBasis =
  (typeof ModerationLegalBasis)[keyof typeof ModerationLegalBasis];

/**
 * Top-level reason bucket for a report, chosen before a precise ReportMotif.
 * Deliberately generic across every ReportTargetType (not comment-specific) —
 * COMMENT is the only target with a report button today, but the categories
 * were designed to also make sense for a future REVIEW/USER/LIST report.
 * OTHER skips the motif step: the free-text `reason` carries the detail.
 */
export const ReportCategory = {
  SPAM: "SPAM",
  ILLEGAL_CONTENT: "ILLEGAL_CONTENT",
  HARASSMENT: "HARASSMENT",
  HATE_SPEECH: "HATE_SPEECH",
  SEXUAL_CONTENT: "SEXUAL_CONTENT",
  VIOLENCE: "VIOLENCE",
  MINOR_ENDANGERMENT: "MINOR_ENDANGERMENT",
  SPOILER: "SPOILER",
  IMPERSONATION: "IMPERSONATION",
  MISINFORMATION: "MISINFORMATION",
  STOLEN_CONTENT: "STOLEN_CONTENT",
  MISLEADING_REVIEW: "MISLEADING_REVIEW",
  OTHER: "OTHER",
} as const;
export type ReportCategory =
  (typeof ReportCategory)[keyof typeof ReportCategory];

/** Precise reason within a ReportCategory. OTHER has no motif — see above. */
export const ReportMotif = {
  SPAM_PROMOTIONAL: "SPAM_PROMOTIONAL",
  SPAM_SUSPICIOUS_LINK: "SPAM_SUSPICIOUS_LINK",
  SPAM_REPEATED: "SPAM_REPEATED",
  ILLEGAL_PIRACY_LINK: "ILLEGAL_PIRACY_LINK",
  HARASSMENT_INSULTS: "HARASSMENT_INSULTS",
  HARASSMENT_THREATS: "HARASSMENT_THREATS",
  HARASSMENT_STALKING: "HARASSMENT_STALKING",
  HARASSMENT_DOXXING: "HARASSMENT_DOXXING",
  HATE_RACISM: "HATE_RACISM",
  HATE_SEXISM_LGBTQ: "HATE_SEXISM_LGBTQ",
  HATE_OTHER: "HATE_OTHER",
  SEXUAL_EXPLICIT: "SEXUAL_EXPLICIT",
  VIOLENCE_GRAPHIC: "VIOLENCE_GRAPHIC",
  MINOR_ENDANGERMENT_CONTENT: "MINOR_ENDANGERMENT_CONTENT",
  MINOR_ENDANGERMENT_SOLICITATION: "MINOR_ENDANGERMENT_SOLICITATION",
  SPOILER_UNTAGGED: "SPOILER_UNTAGGED",
  IMPERSONATION_REAL_PERSON: "IMPERSONATION_REAL_PERSON",
  IMPERSONATION_FAKE_ACCOUNT: "IMPERSONATION_FAKE_ACCOUNT",
  MISINFORMATION_FALSE_FACT: "MISINFORMATION_FALSE_FACT",
  STOLEN_CONTENT_PLAGIARIZED: "STOLEN_CONTENT_PLAGIARIZED",
  MISLEADING_REVIEW_MANIPULATION: "MISLEADING_REVIEW_MANIPULATION",
} as const;
export type ReportMotif = (typeof ReportMotif)[keyof typeof ReportMotif];

/**
 * Which ReportMotif values are valid under each ReportCategory — the single
 * source of truth for both the picker UI (category -> motif options) and
 * server-side validation (ReportService.create rejects a mismatched pair).
 * OTHER maps to an empty list: it has no motif, only the free-text `reason`.
 */
export const REPORT_CATEGORY_MOTIFS: Record<ReportCategory, ReportMotif[]> = {
  SPAM: [
    ReportMotif.SPAM_PROMOTIONAL,
    ReportMotif.SPAM_SUSPICIOUS_LINK,
    ReportMotif.SPAM_REPEATED,
  ],
  ILLEGAL_CONTENT: [ReportMotif.ILLEGAL_PIRACY_LINK],
  HARASSMENT: [
    ReportMotif.HARASSMENT_INSULTS,
    ReportMotif.HARASSMENT_THREATS,
    ReportMotif.HARASSMENT_STALKING,
    ReportMotif.HARASSMENT_DOXXING,
  ],
  HATE_SPEECH: [
    ReportMotif.HATE_RACISM,
    ReportMotif.HATE_SEXISM_LGBTQ,
    ReportMotif.HATE_OTHER,
  ],
  SEXUAL_CONTENT: [ReportMotif.SEXUAL_EXPLICIT],
  VIOLENCE: [ReportMotif.VIOLENCE_GRAPHIC],
  MINOR_ENDANGERMENT: [
    ReportMotif.MINOR_ENDANGERMENT_CONTENT,
    ReportMotif.MINOR_ENDANGERMENT_SOLICITATION,
  ],
  SPOILER: [ReportMotif.SPOILER_UNTAGGED],
  IMPERSONATION: [
    ReportMotif.IMPERSONATION_REAL_PERSON,
    ReportMotif.IMPERSONATION_FAKE_ACCOUNT,
  ],
  MISINFORMATION: [ReportMotif.MISINFORMATION_FALSE_FACT],
  STOLEN_CONTENT: [ReportMotif.STOLEN_CONTENT_PLAGIARIZED],
  MISLEADING_REVIEW: [ReportMotif.MISLEADING_REVIEW_MANIPULATION],
  OTHER: [],
};

/**
 * A list's kind: RANKED shows explicit rank order (drag-to-reorder, "top
 * 10"), COLLECTION is an unordered grid. Same storage (items + position)
 * either way — the front adapts its rendering per kind.
 */
export const ListKind = {
  RANKED: "RANKED",
  COLLECTION: "COLLECTION",
} as const;
export type ListKind = (typeof ListKind)[keyof typeof ListKind];

/**
 * A list's own explicit audience — mirrors Review's own-scope pattern, not
 * the per-domain VisibilitySetting facets (a list isn't tied to one domain).
 * Unlike ReviewVisibility, PRIVATE exists here: a list defaults to it.
 */
export const ListVisibility = {
  PRIVATE: "PRIVATE",
  FRIENDS: "FRIENDS",
  PUBLIC: "PUBLIC",
} as const;
export type ListVisibility =
  (typeof ListVisibility)[keyof typeof ListVisibility];

export const Locale = ["fr", "en"] as const;
export type Locale = (typeof Locale)[number];

// ---------------------------------------------------------------------------
// Gamification (G1). Mirrors `apps/api/prisma/schema.prisma`'s `XpEntry.reason`
// — a plain String column there, not a Prisma enum (same rationale as
// `ActivityEvent.type`: a new reason needs no migration). The full barème
// (amount/cap/source per reason) lives in `xp-rules.ts`, not here.
// ---------------------------------------------------------------------------

/**
 * Every source of XP the app can credit. See `xp-rules.ts` for the amount,
 * daily cap and source table backing each one. A few are declared here but
 * not wired to any caller yet (ONBOARDING_STEP: G8, PROFILE_COMPLETED: no
 * ticket yet, ACHIEVEMENT_UNLOCKED: G2, ADMIN_ADJUSTMENT: B8) — the enum is
 * the barème's full shape from day one, so later tickets only add a call
 * site, never touch this list.
 */
export const XpReason = {
  EPISODE_WATCHED: "EPISODE_WATCHED",
  MOVIE_WATCHED: "MOVIE_WATCHED",
  MOVIE_REPLAYED: "MOVIE_REPLAYED",
  SEASON_COMPLETED: "SEASON_COMPLETED",
  SERIES_COMPLETED: "SERIES_COMPLETED",
  GAME_FINISHED: "GAME_FINISHED",
  GAME_REPLAYED: "GAME_REPLAYED",
  BOOK_FINISHED: "BOOK_FINISHED",
  BOOK_REPLAYED: "BOOK_REPLAYED",
  ALBUM_LISTENED: "ALBUM_LISTENED",
  WORK_ADDED: "WORK_ADDED",
  DOMAIN_STARTED: "DOMAIN_STARTED",
  WORK_RATED: "WORK_RATED",
  REVIEW_WRITTEN: "REVIEW_WRITTEN",
  REVIEW_DETAILED: "REVIEW_DETAILED",
  COMMENT_POSTED: "COMMENT_POSTED",
  REVIEW_VOTE_RECEIVED: "REVIEW_VOTE_RECEIVED",
  COMMENT_REACTION_RECEIVED: "COMMENT_REACTION_RECEIVED",
  LIST_CREATED: "LIST_CREATED",
  IMPORT_COMPLETED: "IMPORT_COMPLETED",
  ONBOARDING_STEP: "ONBOARDING_STEP",
  PROFILE_COMPLETED: "PROFILE_COMPLETED",
  ACHIEVEMENT_UNLOCKED: "ACHIEVEMENT_UNLOCKED",
  ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT",
} as const;
export type XpReason = (typeof XpReason)[keyof typeof XpReason];
