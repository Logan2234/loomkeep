export const keys = {
  stats: {
    all: () => ["stats"] as const,
    books: () => ["stats", "books"] as const,
  },
  books: {
    detail: (source: string, sourceId: string) =>
      ["books", "detail", source, sourceId] as const,
  },
  feed: {
    all: () => ["feed"] as const,
    preview: () => ["feed", "preview"] as const,
  },
  profile: {
    activity: (username: string) => ["profile", "activity", username] as const,
    myReviews: () => ["profile", "my-reviews"] as const,
  },
  library: {
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
  },
  admin: {
    overview: () => ["admin", "overview"] as const,
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
