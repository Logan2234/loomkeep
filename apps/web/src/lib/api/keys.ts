export const keys = {
  stats: {
    all: () => ["stats"] as const,
    books: () => ["stats", "books"] as const,
  },
  books: {
    detail: (source: string, sourceId: string) =>
      ["books", "detail", source, sourceId] as const,
  },
} as const;
