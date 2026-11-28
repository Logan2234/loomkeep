import type { QueryKey } from "@tanstack/svelte-query";
import { keys } from "./keys";

declare const invalidationBrand: unique symbol;

/**
 * What a mutation touched, as the query keys to refetch once it settles.
 * Only built here: `createApiMutation`'s `invalidates` takes nothing else,
 * so what changes with an entity is written once, not at each call site.
 */
export type Invalidation = readonly QueryKey[] & {
  readonly [invalidationBrand]: true;
};

const of = (...queryKeys: QueryKey[]): Invalidation =>
  queryKeys as unknown as Invalidation;

type TrackedDomain = "media" | "games" | "books" | "music";

const TRACKED: Record<TrackedDomain, () => QueryKey> = {
  media: keys.library.tracked,
  games: keys.games.tracked,
  books: keys.books.tracked,
  music: keys.music.tracked,
};

export const invalidate = {
  /** Combines several entities a mutation touched. */
  all: (...touched: Invalidation[]): Invalidation =>
    of(...touched.flatMap((keysOf) => [...keysOf])),
  /**
   * The screen's own queries, whose key it holds: its detail page, a saga
   * block, a filtered admin table. Not for an entity other screens show.
   */
  shown: (...queryKeys: QueryKey[]) => of(...queryKeys),

  // Library
  /**
   * A work tracked, changed or removed: its page, and every screen showing
   * the library (lists, counts, home widgets, stats, calendar).
   */
  libraryEntry: (detailKey: QueryKey) =>
    of(
      detailKey,
      keys.library.all(),
      keys.home.all(),
      keys.stats.all(),
      keys.calendar.upcoming(),
    ),
  library: () => of(keys.library.all()),
  /** A release reminder on a work: its page and the calendar. */
  releaseReminder: (detailKey: QueryKey) =>
    of(detailKey, keys.calendar.upcoming()),
  /** A premiere followed: the "tracked" flags and the calendar. */
  premiereFollow: () => of(keys.library.tracked(), keys.calendar.upcoming()),
  /** The "already tracked" flags on search results. */
  tracked: (...domains: TrackedDomain[]) =>
    of(...domains.map((domain) => TRACKED[domain]())),
  /** Works added from search: results and every domain's tracked flags. */
  searchResults: () =>
    of(
      keys.search.all(),
      ...(Object.keys(TRACKED) as TrackedDomain[]).map((d) => TRACKED[d]()),
    ),
  savedViews: () => of(keys.savedViews.all()),
  /** A work saved from a shared link: its domain, the library, every list. */
  quickAdd: (domainKey: QueryKey) =>
    of(domainKey, keys.library.all(), keys.lists.all()),
  /** A reading or play session: the entry, its stats, the feed, the XP bar. */
  session: (
    entryKey: QueryKey,
    detailKey: QueryKey,
    domainStatsKey: QueryKey,
    { progression = true } = {},
  ) =>
    of(
      entryKey,
      detailKey,
      domainStatsKey,
      keys.stats.social(),
      ...(progression ? [keys.gamification.progression()] : []),
      keys.feed.all(),
    ),
  sessionTimer: () => of(keys.sessionTimer.current()),

  // Lists
  lists: () => of(keys.lists.editable()),
  /** A work added to or taken off lists: the lists and its membership. */
  listMembership: (membershipKey: QueryKey) =>
    of(keys.lists.editable(), membershipKey),
  list: (listId: string) => of(keys.lists.detail(listId)),
  listMembers: (listId: string) =>
    of(
      keys.lists.members(listId),
      keys.lists.memberCandidates(listId),
      keys.lists.detail(listId),
    ),

  // Chat
  chatConversations: () => of(keys.chat.conversations()),
  /** The inbox and its unread badge. */
  chatInbox: () => of(keys.chat.conversations(), keys.chat.unread()),
  chatConversation: (id: string) =>
    of(
      keys.chat.conversation(id),
      keys.chat.conversations(),
      keys.chat.unread(),
    ),
  chatPins: (conversationId: string) => of(keys.chat.pins(conversationId)),
  chatWorkThreads: () => of(keys.chat.workThreads()),
  chatWorkThread: (targetType: string, targetId: string) =>
    of(
      keys.chat.workThread(targetType, targetId),
      keys.chat.workThreads(),
      keys.chat.unread(),
    ),

  // Social, profile, reviews
  personalInvitation: () => of(keys.social.invitation()),
  blockedUsers: () => of(keys.social.blockedUsers()),
  profile: (username: string) => of(keys.profile.detail(username)),
  myReviews: () => of(keys.profile.myReviews()),

  // Gamification
  achievements: () => of(keys.gamification.achievements()),
  onboarding: () => of(keys.gamification.onboarding()),

  // Account
  apiKeys: () => of(keys.apiKeys.all()),
  sessions: () => of(keys.sessions.all()),
  pushDevices: () => of(keys.notifications.pushDevices()),

  // Admin
  adminBackups: () => of(keys.admin.backups()),
  adminInvitations: () => of(keys.admin.invitations()),
  adminJobs: () => of(keys.admin.jobs()),
  adminInstanceSettings: () => of(keys.admin.instanceSettings()),
  adminPush: (email?: string) =>
    of(
      ...(email === undefined ? [] : [keys.admin.pushDevices(email)]),
      keys.admin.pushSummary(),
    ),
  /** A report moderated: the queue shown, its summary and pending badge. */
  adminReports: (reportsKey: QueryKey) =>
    of(
      reportsKey,
      keys.admin.reportsSummary(),
      keys.admin.reportsPendingCount(),
    ),
  adminUsers: () => of(keys.admin.allUsers()),
  adminUser: (userId: string) =>
    of(keys.admin.user(userId), keys.admin.allUsers()),
  adminUserSessions: (userId: string) => of(keys.admin.userSessions(userId)),
};
