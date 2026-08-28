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
  },
  admin: {
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
  },
} as const;
