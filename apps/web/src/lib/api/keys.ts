export const keys = {
  stats: {
    all: () => ["stats"] as const,
    books: () => ["stats", "books"] as const,
  },
  books: {
    detail: (source: string, sourceId: string) =>
      ["books", "detail", source, sourceId] as const,
    reading: () => ["books", "reading"] as const,
    tracked: () => ["books", "tracked"] as const,
  },
  games: {
    playing: () => ["games", "playing"] as const,
    detail: (source: string, sourceId: string) =>
      ["games", "detail", source, sourceId] as const,
    tracked: () => ["games", "tracked"] as const,
  },
  music: {
    toListen: () => ["music", "to-listen"] as const,
    detail: (source: string, sourceId: string) =>
      ["music", "detail", source, sourceId] as const,
    tracked: () => ["music", "tracked"] as const,
  },
  media: {
    detail: (type: string, sourceId: string) =>
      ["media", "detail", type, sourceId] as const,
    extras: (source: string, sourceId: string) =>
      ["media", "extras", source, sourceId] as const,
  },
  calendar: {
    upcoming: () => ["calendar", "upcoming"] as const,
  },
  import: {
    availability: () => ["import", "availability"] as const,
    quota: () => ["import", "quota"] as const,
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
  verification: {
    email: (token: string) => ["verification", "email", token] as const,
    newsletterUnsubscribe: (token: string) =>
      ["verification", "newsletter-unsubscribe", token] as const,
  },
  lists: {
    editable: () => ["lists", "editable"] as const,
    forUser: (username: string) => ["lists", "for-user", username] as const,
    members: (listId: string) => ["lists", "members", listId] as const,
    detail: (listId: string) => ["lists", "detail", listId] as const,
  },
  calendarSubscribe: {
    token: () => ["calendar-subscribe", "token"] as const,
  },
  reviews: {
    mine: (targetType: string, targetId: string) =>
      ["reviews", "mine", targetType, targetId] as const,
    community: (targetType: string, targetId: string) =>
      ["reviews", "community", targetType, targetId] as const,
  },
  feed: {
    all: () => ["feed"] as const,
    preview: () => ["feed", "preview"] as const,
  },
  notifications: {
    feed: () => ["notifications", "feed"] as const,
  },
  profile: {
    activity: (username: string) => ["profile", "activity", username] as const,
    myReviews: () => ["profile", "my-reviews"] as const,
    detail: (username: string) => ["profile", "detail", username] as const,
    connections: (username: string, kind: "followers" | "following") =>
      ["profile", "connections", username, kind] as const,
  },
  library: {
    watching: () => ["library", "watching"] as const,
    plannedMovies: () => ["library", "planned-movies"] as const,
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
    // Whole library, catalogue-identity-keyed — drives the "already
    // tracked" flag on search results.
    tracked: () => ["library", "tracked"] as const,
  },
  catalog: {
    search: (filters: { query: string; type: string | undefined }) =>
      ["catalog", "search", filters] as const,
    castDetail: (source: string, personId: string) =>
      ["catalog", "cast-detail", source, personId] as const,
  },
  admin: {
    overview: () => ["admin", "overview"] as const,
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
    userOptions: () => ["admin", "user-options"] as const,
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
    users: (filters: { query: string; filter: string }) =>
      ["admin", "users", filters] as const,
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
    }) => ["admin", "import-runs", filters] as const,
    importSummary: () => ["admin", "import-summary"] as const,
    reports: (filters: { status: string; reporterId: string | null }) =>
      ["admin", "reports", filters] as const,
    reportsSummary: () => ["admin", "reports-summary"] as const,
  },
} as const;
