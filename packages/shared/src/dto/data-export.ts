import type {
  BookOwnershipStatus,
  BookSource,
  BookStatus,
  CatalogSource,
  CommentEmote,
  CommentTargetType,
  Domain,
  EntryStatus,
  FollowStatus,
  GameOwnershipStatus,
  GameSource,
  GameStatus,
  ListKind,
  ListVisibility,
  MediaType,
  ModerationLegalBasis,
  ModerationMeasure,
  MusicOwnershipStatus,
  MusicSource,
  MusicStatus,
  Plan,
  ReportCategory,
  ReportMotif,
  ReportStatus,
  ReportTargetType,
  ReviewTargetType,
  ReviewVisibility,
  ReviewVoteValue,
  SecurityEventType,
  VisibilityAudience,
  VisibilityFacet,
} from "../enums";
import { UserDto } from "./user";

/** One library entry in a data export: the media plus the user's tracking. */
export interface DataExportEntry {
  media: {
    type: MediaType;
    title: string;
    canonicalSource: CatalogSource;
    /** ID in `canonicalSource` — forms the catalogue identity with `type`. */
    sourceId: string;
    /** All known cross-source identifiers (TMDB, ANILIST, TVDB, IMDB). */
    externalIds: { source: string; externalId: string }[];
  };
  status: EntryStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/** One episode viewing in a data export (rewatches appear as separate rows). */
export interface DataExportWatch {
  media: { type: MediaType; title: string; sourceId: string };
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  watchedAt: string;
}

/** One game library entry in a data export. */
export interface DataExportGameEntry {
  game: {
    title: string;
    canonicalSource: GameSource;
    sourceId: string;
    externalIds: { source: string; externalId: string }[];
  };
  status: GameStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  playtimeMinutes: number;
  ownershipStatus: GameOwnershipStatus;
  ownershipSource: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  /** Completed replays beyond the first, oldest first. */
  replays: string[];
}

/** One book library entry in a data export. */
export interface DataExportBookEntry {
  book: {
    title: string;
    authors: string[];
    canonicalSource: BookSource;
    sourceId: string;
    externalIds: { source: string; externalId: string }[];
  };
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  currentPage: number;
  ownershipStatus: BookOwnershipStatus;
  ownershipSource: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  /** Completed rereads beyond the first, oldest first. */
  replays: string[];
}

/** One album library entry in a data export. */
export interface DataExportMusicEntry {
  album: {
    title: string;
    artists: string[];
    canonicalSource: MusicSource;
    sourceId: string;
    externalIds: { source: string; externalId: string }[];
  };
  status: MusicStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  ownershipStatus: MusicOwnershipStatus;
  ownershipSource: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/** One in-app notification in a data export. */
export interface DataExportNotification {
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  /** Kind-specific extras (episode airDate, social actor identity…). */
  data: Record<string, unknown>;
  createdAt: string;
}

/** One review the user wrote, with its edit history. */
export interface DataExportReview {
  targetType: ReviewTargetType;
  targetId: string;
  /** Best-effort title of the reviewed work; null when it can't be resolved. */
  targetTitle: string | null;
  rating: number;
  text: string | null;
  visibility: ReviewVisibility;
  createdAt: string;
  updatedAt: string;
  revisions: { rating: number; text: string | null; createdAt: string }[];
}

/** One vote the user cast on someone else's review. */
export interface DataExportReviewVote {
  targetType: ReviewTargetType;
  targetId: string;
  value: ReviewVoteValue;
  createdAt: string;
}

/** One comment or reply the user posted. */
export interface DataExportComment {
  targetType: CommentTargetType;
  targetId: string;
  parentId: string | null;
  text: string | null;
  spoilerTag: boolean;
  edited: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One reaction the user left on a comment. */
export interface DataExportCommentReaction {
  commentId: string;
  emote: CommentEmote;
  createdAt: string;
}

/** One work in a user-curated list. */
export interface DataExportListItem {
  targetType: ReviewTargetType;
  targetId: string;
  position: number;
  addedAt: string;
}

/** One list the user owns. */
export interface DataExportList {
  title: string;
  description: string | null;
  kind: ListKind;
  visibility: ListVisibility;
  createdAt: string;
  updatedAt: string;
  items: DataExportListItem[];
}

/** One list owned by someone else where the user was granted edit access. */
export interface DataExportListMembership {
  listTitle: string;
  listOwnerUsername: string;
  createdAt: string;
}

/** One directed follow edge, from either side. */
export interface DataExportFollow {
  username: string;
  status: FollowStatus;
  createdAt: string;
}

/** One user this account has blocked. */
export interface DataExportBlock {
  username: string;
  createdAt: string;
}

/** One report the user filed. */
export interface DataExportReport {
  targetType: ReportTargetType;
  category: ReportCategory | null;
  motif: ReportMotif | null;
  reason: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
}

/** One moderation measure applied against the user (DSA art. 17). */
export interface DataExportModerationDecision {
  measure: ModerationMeasure;
  targetType: ReportTargetType;
  legalBasis: ModerationLegalBasis;
  reasonCategory: ReportCategory | null;
  reasonMotif: ReportMotif | null;
  reasonText: string;
  /** The removed content itself, when the measure was a takedown. */
  contentSnapshot: string | null;
  decidedAt: string;
}

/** One sensitive account action (login, password/email change…). */
export interface DataExportSecurityEvent {
  type: SecurityEventType;
  identifier: string;
  detail: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** One device/browser the account has ever logged in from. */
export interface DataExportDevice {
  deviceKey: string;
  userAgent: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

/** One privacy preference for a domain/facet pair. */
export interface DataExportVisibilitySetting {
  domain: Domain;
  facet: VisibilityFacet;
  audience: VisibilityAudience;
}

/** The account's plan/entitlement state. */
export interface DataExportEntitlement {
  plan: Plan;
  source: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
  overrides: Record<string, unknown>;
}

/** One subscription (billing) record. */
export interface DataExportSubscription {
  provider: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One yearly reading goal. */
export interface DataExportReadingGoal {
  year: number;
  target: number;
  createdAt: string;
  updatedAt: string;
}

/** One committed import (TV Time, Trakt, …). */
export interface DataExportImportRun {
  sourceId: string;
  status: string;
  itemCount: number;
  overwrite: boolean;
  summary: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string;
}

/** Full portable dump of everything the account holds (GDPR "download my data"). */
export interface UserDataExportDto {
  /** ISO datetime the export was produced. */
  exportedAt: string;
  account: UserDto;
  library: DataExportEntry[];
  episodeWatches: DataExportWatch[];
  games: DataExportGameEntry[];
  books: DataExportBookEntry[];
  music: DataExportMusicEntry[];
  /**
   * Reserved for the planned podcasts domain (see `Domain.PODCASTS`). Present in
   * the schema now so the export shape is stable before the domain ships;
   * always an empty array until then.
   */
  podcasts: never[];
  /** Reserved for the planned board-games domain (see `Domain.BOARDGAMES`); always empty until it ships. */
  boardGames: never[];
  notifications: DataExportNotification[];
  reviews: DataExportReview[];
  reviewVotes: DataExportReviewVote[];
  comments: DataExportComment[];
  commentReactions: DataExportCommentReaction[];
  lists: DataExportList[];
  listMemberships: DataExportListMembership[];
  follows: { following: DataExportFollow[]; followers: DataExportFollow[] };
  // Users this account blocked. Who blocked *this* account is deliberately
  // excluded — blocking is designed to be silent so the blocked party never
  // learns of it (see Block model in schema.prisma).
  blocks: { blocking: DataExportBlock[] };
  reports: DataExportReport[];
  moderationDecisions: DataExportModerationDecision[];
  securityEvents: DataExportSecurityEvent[];
  devices: DataExportDevice[];
  visibilitySettings: DataExportVisibilitySetting[];
  entitlement: DataExportEntitlement;
  subscriptions: DataExportSubscription[];
  readingGoals: DataExportReadingGoal[];
  importRuns: DataExportImportRun[];
}

/**
 * Flat, per-domain CSV export meant for migrating to another tool (as opposed
 * to `UserDataExportDto`, the nested GDPR dump) — one row per library entry.
 */
export interface CsvExportDto {
  csv: string;
}
