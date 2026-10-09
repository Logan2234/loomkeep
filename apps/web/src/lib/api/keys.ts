export const keys = {
  stats: {
    all: () => ["stats"] as const,
    books: () => ["stats", "books"] as const,
    games: () => ["stats", "games"] as const,
    music: () => ["stats", "music"] as const,
    social: () => ["stats", "social"] as const,
    video: () => ["stats", "video"] as const,
    videoTemporal: (period: string) =>
      ["stats", "video-temporal", period] as const,
    overview: (domain: string) => ["stats", "overview", domain] as const,
    piles: (domain: string) => ["stats", "piles", domain] as const,
  },
  gamification: {
    achievements: () => ["gamification", "achievements"] as const,
    pending: () => ["gamification", "pending"] as const,
    progression: () => ["gamification", "progression"] as const,
    xpHistory: () => ["gamification", "xpHistory"] as const,
    leaderboard: (scope: string, period: string) =>
      ["gamification", "leaderboard", scope, period] as const,
    onboarding: () => ["gamification", "onboarding"] as const,
  },
  books: {
    detail: (source: string, sourceId: string, edition?: string) =>
      ["books", "detail", source, sourceId, edition] as const,
    editions: (source: string, sourceId: string) =>
      ["books", "editions", source, sourceId] as const,
    reading: (sort: string) => ["books", "reading", sort] as const,
    tracked: () => ["books", "tracked"] as const,
    // Keyed on whether the book is tracked: tracking it ties it to its series.
    saga: (seriesKey: string, tracked: boolean) =>
      ["books", "saga", seriesKey, tracked] as const,
    sagas: (filters: object) => ["books", "sagas", filters] as const,
    search: (query: string) => ["books", "search", query] as const,
    sessionsRoot: (entryId: string) => ["books", "sessions", entryId] as const,
    sessions: (entryId: string, page = 1) =>
      ["books", "sessions", entryId, page] as const,
  },
  games: {
    // Keyed on whether the game is tracked: tracking it ties it to its series.
    saga: (sourceId: string, tracked: boolean) =>
      ["games", "saga", sourceId, tracked] as const,
    sagas: (filters: object) => ["games", "sagas", filters] as const,
    playing: (sort: string) => ["games", "playing", sort] as const,
    detail: (source: string, sourceId: string) =>
      ["games", "detail", source, sourceId] as const,
    tracked: () => ["games", "tracked"] as const,
    search: (query: string) => ["games", "search", query] as const,
    sessionsRoot: (entryId: string) => ["games", "sessions", entryId] as const,
    sessions: (entryId: string, page = 1) =>
      ["games", "sessions", entryId, page] as const,
  },
  music: {
    toListen: (sort: string) => ["music", "to-listen", sort] as const,
    detail: (source: string, sourceId: string) =>
      ["music", "detail", source, sourceId] as const,
    tracked: () => ["music", "tracked"] as const,
    search: (query: string) => ["music", "search", query] as const,
  },
  media: {
    detail: (type: string, sourceId: string) =>
      ["media", "detail", type, sourceId] as const,
    extras: (source: string, sourceId: string, region: string | null) =>
      ["media", "extras", source, sourceId, region] as const,
    saga: (type: string, sourceId: string, tracked: boolean) =>
      ["media", "saga", type, sourceId, tracked] as const,
  },
  calendar: {
    upcoming: () => ["calendar", "upcoming"] as const,
  },
  import: {
    availability: () => ["import", "availability"] as const,
    history: () => ["import", "history"] as const,
    lastRun: () => ["import", "last-run"] as const,
    quota: () => ["import", "quota"] as const,
    job: (source: string, jobId: string) =>
      ["import", "job", source, jobId] as const,
  },
  account: {
    deletionSummary: () => ["account", "deletion-summary"] as const,
  },
  mfa: {
    status: () => ["mfa", "status"] as const,
  },
  sessions: {
    all: () => ["sessions", "all"] as const,
  },
  apiKeys: {
    all: () => ["api-keys", "all"] as const,
    quota: () => ["api-keys", "quota"] as const,
  },
  sessionTimer: {
    current: () => ["session-timer"] as const,
  },
  ee: {
    status: () => ["ee", "status"] as const,
  },
  securityEvents: {
    all: () => ["security-events", "all"] as const,
  },
  verification: {
    email: (token: string) => ["verification", "email", token] as const,
    newsletterUnsubscribe: (token: string) =>
      ["verification", "newsletter-unsubscribe", token] as const,
    invitation: (token: string) =>
      ["verification", "invitation", token] as const,
  },
  savedViews: {
    all: () => ["saved-views"] as const,
    content: (id: string, filters: unknown) =>
      ["saved-views", "content", id, filters] as const,
  },
  lists: {
    editable: () => ["lists", "editable"] as const,
    membership: (targetType: string, targetId: string) =>
      ["lists", "membership", targetType, targetId] as const,
    forUser: (username: string) => ["lists", "for-user", username] as const,
    members: (listId: string) => ["lists", "members", listId] as const,
    memberCandidates: (listId: string) =>
      ["lists", "member-candidates", listId] as const,
    detail: (listId: string) => ["lists", "detail", listId] as const,
  },
  calendarSubscribe: {
    token: () => ["calendar-subscribe", "token"] as const,
  },
  activityFeedSubscribe: {
    token: () => ["activity-feed-subscribe", "token"] as const,
  },
  privacy: {
    settings: () => ["privacy", "settings"] as const,
  },
  reviews: {
    mine: (targetType: string, targetId: string) =>
      ["reviews", "mine", targetType, targetId] as const,
    community: (targetType: string, targetId: string) =>
      ["reviews", "community", targetType, targetId] as const,
    revisions: (targetType: string, targetId: string) =>
      ["reviews", "revisions", targetType, targetId] as const,
  },
  home: {
    favorites: (domain: string) => ["home", "favorites", domain] as const,
    onThisDay: (date: string) => ["home", "on-this-day", date] as const,
    tonightPick: () => ["home", "tonight-pick"] as const,
  },
  feed: {
    all: () => ["feed"] as const,
    list: (domain: string | null) => ["feed", "list", domain ?? "ALL"] as const,
    // The home widget's merged first pages — not the feed page's infinite
    // query, whose cached shape differs.
    home: (domains: string) => ["feed", "home", domains] as const,
  },
  chat: {
    all: () => ["chat"] as const,
    unread: () => ["chat", "unread"] as const,
    conversations: () => ["chat", "conversations"] as const,
    conversation: (id: string) => ["chat", "conversation", id] as const,
    messages: (id: string) => ["chat", "messages", id] as const,
    friends: (query: string) => ["chat", "friends", query] as const,
    pins: (id: string) => ["chat", "pins", id] as const,
    works: (id: string) => ["chat", "works", id] as const,
    search: (id: string, query: string) =>
      ["chat", "search", id, query] as const,
    // Outside ["chat"]: a reconnection refetches what's under it, and this
    // one is catalogue searches.
    workSearch: (query: string) => ["chat-work-search", query] as const,
    linkPreviews: (urls: string[]) => ["chat-link-previews", ...urls] as const,
    linkPreview: (url: string) => ["chat-link-preview", url] as const,
  },
  notifications: {
    feed: () => ["notifications", "feed"] as const,
    pushDevices: () => ["notifications", "push-devices"] as const,
  },
  social: {
    followRequests: () => ["social", "follow-requests"] as const,
    blockedUsers: () => ["social", "blocked-users"] as const,
  },
  profile: {
    activity: (username: string) => ["profile", "activity", username] as const,
    myReviews: () => ["profile", "my-reviews"] as const,
    detail: (username: string) => ["profile", "detail", username] as const,
    connections: (username: string, kind: "followers" | "following") =>
      ["profile", "connections", username, kind] as const,
  },
  library: {
    domainCounts: () => ["library", "domain-counts"] as const,
    watching: () => ["library", "watching"] as const,
    plannedMovies: () => ["library", "planned-movies"] as const,
    sagas: (filters: object) => ["library", "sagas", filters] as const,
    dormant: () => ["library", "dormant"] as const,
    browse: (
      domain: string,
      filters: {
        query: string;
        statuses: string[];
        favoritesOnly: boolean;
        extra: unknown;
        sort: string;
        order: string;
      },
    ) => ["library", "browse", domain, filters] as const,
    // Under the same "browse" prefix as the list it sums, so whatever
    // refreshes one domain's list refreshes its pile too.
    pile: (
      domain: string,
      filters: {
        query: string;
        statuses: string[];
        favoritesOnly: boolean;
        extra: unknown;
      },
    ) => ["library", "browse", domain, "pile", filters] as const,
    // Whole library, catalogue-identity-keyed — drives the "already
    // tracked" flag on search results.
    tracked: () => ["library", "tracked"] as const,
  },
  links: {
    resolve: (url: string) => ["links", "resolve", url] as const,
  },
  catalog: {
    search: (filters: { query: string; type: string | undefined }) =>
      ["catalog", "search", filters] as const,
    castDetail: (source: string, personId: string) =>
      ["catalog", "cast-detail", source, personId] as const,
    watchProviders: (region: string | null) =>
      ["catalog", "watch-providers", region] as const,
  },
  admin: {
    overview: () => ["admin", "overview"] as const,
    instanceSettings: () => ["admin", "instance-settings"] as const,
    reportsPendingCount: () => ["admin", "reports-pending-count"] as const,
    newsletterSends: () => ["admin", "newsletter-sends"] as const,
    schema: () => ["admin", "schema"] as const,
    emailTemplates: () => ["admin", "email-templates"] as const,
    pushDevices: (email: string) => ["admin", "push-devices", email] as const,
    pushSummary: () => ["admin", "push-summary"] as const,
    accountsStats: () => ["admin", "accounts-stats"] as const,
    catalogueStats: () => ["admin", "catalogue-stats"] as const,
    socialStats: () => ["admin", "social-stats"] as const,
    systemStats: () => ["admin", "system-stats"] as const,
    userOptions: (search: string) => ["admin", "user-options", search] as const,
    services: () => ["admin", "services"] as const,
    jobs: () => ["admin", "jobs"] as const,
    backups: () => ["admin", "backups"] as const,
    securityEvents: (filters: { type: string | null; identifier: string }) =>
      ["admin", "security-events", filters] as const,
    securitySummary: () => ["admin", "security-summary"] as const,
    cacheItems: (filters: {
      domain: string;
      search: string;
      sort: string;
      orphansOnly: boolean;
    }) => ["admin", "cache-items", filters] as const,
    cacheItem: (domain: string, id: string) =>
      ["admin", "cache-item", domain, id] as const,
    users: (filters: {
      query: string;
      filter: string;
      createdFrom: string;
      createdTo: string;
      activeFrom: string;
      activeTo: string;
      mfa: string;
      newsletter: string;
      push: string;
      session: string;
    }) => ["admin", "users", filters] as const,
    invitations: (filters?: { query: string; status: string }) =>
      filters
        ? (["admin", "invitations", filters] as const)
        : (["admin", "invitations"] as const),
    userSessions: (userId: string) =>
      ["admin", "user-sessions", userId] as const,
    userLibraryStats: (userId: string) =>
      ["admin", "user-library-stats", userId] as const,
    userReviews: (userId: string) => ["admin", "user-reviews", userId] as const,
    userComments: (userId: string) =>
      ["admin", "user-comments", userId] as const,
    userFollowers: (userId: string) =>
      ["admin", "user-followers", userId] as const,
    userFollowing: (userId: string) =>
      ["admin", "user-following", userId] as const,
    userLists: (userId: string) => ["admin", "user-lists", userId] as const,
    userReportsAgainst: (userId: string) =>
      ["admin", "user-reports-against", userId] as const,
    importRuns: (filters: {
      source: string;
      status: string;
      userId: string | null;
      from?: string;
      to?: string;
    }) => ["admin", "import-runs", filters] as const,
    importDetail: (id: string) => ["admin", "import-detail", id] as const,
    importSummary: () => ["admin", "import-summary"] as const,
    reports: (filters: { status: string; reporterId: string | null }) =>
      ["admin", "reports", filters] as const,
    reportsSummary: () => ["admin", "reports-summary"] as const,
  },
  transparency: (year: number | undefined) => ["transparency", year] as const,
} as const;
