// Query key factory — see docs/plans/centralized-api-layer.md §4. Keys are
// hierarchical arrays so invalidating a parent (e.g. keys.stats.all()) also
// invalidates every child. Grown per migration phase, not enumerated upfront.
export const keys = {
  stats: {
    all: () => ["stats"] as const,
    books: () => ["stats", "books"] as const,
  },
} as const;
