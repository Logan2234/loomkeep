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
  SessionSource,
  TrackingCycleStatus,
  VisibilityAudience,
  VisibilityFacet,
} from "../enums";
import type { SavedViewDto } from "./saved-view";
import { UserDto } from "./user";

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
  /** When each rewatch of a film ended. */
  replays: string[];
}

export interface DataExportWatch {
  media: { type: MediaType; title: string; sourceId: string };
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  watchedAt: string | null;
}

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
  trackedPlaytimeMinutes: number;
  steamPlaytimeMinutes: number | null;
  steamSyncedAt: string | null;
  ownershipStatus: GameOwnershipStatus;
  ownershipSource: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  /** Completed replays beyond the first, oldest first. */
  replays: string[];
  /** Every playthrough, the first and the unfinished ones included. */
  playthroughs: {
    number: number;
    status: TrackingCycleStatus;
    startedAt: string | null;
    finishedAt: string | null;
    trackedMinutes: number;
  }[];
  sessions: {
    playthroughNumber: number | null;
    durationMinutes: number;
    notes: string | null;
    occurredAt: string;
    source: SessionSource;
    createdAt: string;
  }[];
}

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
  editionKey: string | null;
  referencePageCount: number | null;
  trackedReadingMinutes: number;
  ownershipStatus: BookOwnershipStatus;
  ownershipSource: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  /** Completed rereads beyond the first, oldest first. */
  replays: string[];
  /** Every reading, the first and the unfinished ones included. */
  readings: {
    number: number;
    status: TrackingCycleStatus;
    editionKey: string | null;
    referencePageCount: number | null;
    currentPage: number;
    pagesRead: number;
    trackedMinutes: number;
    startedAt: string | null;
    finishedAt: string | null;
  }[];
  sessions: {
    readingNumber: number | null;
    durationMinutes: number;
    pagesRead: number;
    startPage: number | null;
    endPage: number | null;
    notes: string | null;
    occurredAt: string;
    source: SessionSource;
    createdAt: string;
  }[];
}

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

export interface DataExportNotification {
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  /** Kind-specific extras (episode airDate, social actor identity…). */
  data: Record<string, unknown>;
  createdAt: string;
}

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

export interface DataExportReviewVote {
  targetType: ReviewTargetType;
  targetId: string;
  value: ReviewVoteValue;
  createdAt: string;
}

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

export interface DataExportCommentReaction {
  commentId: string;
  emote: CommentEmote;
  createdAt: string;
}

export interface DataExportListItem {
  targetType: ReviewTargetType;
  targetId: string;
  position: number;
  addedAt: string;
}

export interface DataExportList {
  title: string;
  description: string | null;
  kind: ListKind;
  visibility: ListVisibility;
  createdAt: string;
  updatedAt: string;
  items: DataExportListItem[];
}

export interface DataExportListMembership {
  listTitle: string;
  listOwnerUsername: string;
  createdAt: string;
}

export interface DataExportFollow {
  username: string;
  status: FollowStatus;
  createdAt: string;
}

export interface DataExportBlock {
  username: string;
  createdAt: string;
}

export interface DataExportReport {
  targetType: ReportTargetType;
  category: ReportCategory | null;
  motif: ReportMotif | null;
  reason: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
}

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

export interface DataExportSecurityEvent {
  type: SecurityEventType;
  identifier: string;
  detail: string | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
}

/** What `account` doesn't carry: consents, account history, the photo itself. */
export interface DataExportAccountRecord {
  termsAcceptedAt: string | null;
  ageCertifiedAt: string | null;
  newsletterOptInAt: string | null;
  lastActiveAt: string | null;
  suspendedUntil: string | null;
  equippedBadgeKeys: string[];
  avatar: { mimeType: string; base64: string } | null;
  /** An email change asked for and not confirmed yet. */
  pendingEmailChange: { newEmail: string; expiresAt: string } | null;
  /** The invitation the account signed up with. */
  invitation: { label: string | null; invitedBy: string | null } | null;
}

/** A work this account added to a list it doesn't own. */
export interface DataExportListItemAdded {
  listTitle: string;
  listOwnerUsername: string;
  targetType: ReviewTargetType;
  targetId: string;
  addedAt: string;
}

/** The session timer running when the export was made. */
export interface DataExportSessionTimer {
  domain: Domain;
  /** The game or book it times. */
  title: string | null;
  startedAt: string;
  pausedAt: string | null;
  accumulatedSeconds: number;
}

/** A signed-in session — never its token. */
export interface DataExportSession {
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

/** A shared list whose notifications are muted. */
export interface DataExportListMute {
  listTitle: string;
  mutedAt: string;
}

export interface DataExportActivity {
  type: string;
  domain: string;
  title: string;
  href: string | null;
  createdAt: string;
}

export interface DataExportProgression {
  xp: number;
  xpEntries: {
    reason: string;
    amount: number;
    createdAt: string;
    revokedAt: string | null;
  }[];
  achievements: { key: string; unlockedAt: string }[];
}

/** A personal API key — never its secret. */
export interface DataExportApiKey {
  name: string;
  suffix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

/** A passkey — never its key material. */
export interface DataExportPasskey {
  name: string;
  deviceType: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** A browser that receives push notifications — never its endpoint or keys. */
export interface DataExportPushSubscription {
  userAgent: string | null;
  createdAt: string;
}

export interface DataExportDevice {
  deviceKey: string;
  userAgent: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DataExportVisibilitySetting {
  domain: Domain;
  facet: VisibilityFacet;
  audience: VisibilityAudience;
}

export interface DataExportEntitlement {
  plan: Plan;
  source: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
  overrides: Record<string, unknown>;
}

export interface DataExportSubscription {
  provider: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataExportReadingGoal {
  year: number;
  target: number;
  createdAt: string;
  updatedAt: string;
}

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
  accountRecord: DataExportAccountRecord;
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
  /** With their ids: a home widget of `account.homeLayout` refers to one by it. */
  savedViews: SavedViewDto[];
  activity: DataExportActivity[];
  progression: DataExportProgression;
  apiKeys: DataExportApiKey[];
  passkeys: DataExportPasskey[];
  pushSubscriptions: DataExportPushSubscription[];
  listItemsAdded: DataExportListItemAdded[];
  sessionTimer: DataExportSessionTimer | null;
  sessions: DataExportSession[];
  listMutes: DataExportListMute[];
}

/**
 * Flat, per-domain CSV export meant for migrating to another tool (as opposed
 * to `UserDataExportDto`, the nested GDPR dump) — one row per library entry.
 */
export interface CsvExportDto {
  csv: string;
}

/** One CSV of a migration export, importable on its own. */
export interface MigrationExportFileDto {
  /** Base name, without date nor extension: "letterboxd-diary-2". */
  name: string;
  csv: string;
}

/**
 * A library in another service's import format (Letterboxd, Goodreads). Several
 * files when the service imports them separately, or caps their size.
 */
export interface MigrationExportDto {
  files: MigrationExportFileDto[];
}
