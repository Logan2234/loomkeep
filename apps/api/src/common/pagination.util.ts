/** Parsed, safe `page`/`limit` query params for a `GET` list endpoint. */
export interface ParsedPage {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

const MAX_LIMIT = 200;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Parses `page`/`limit` query string params (1-indexed page, endpoint-specific
 * default limit) into `{ page, limit, skip, take }` for a Prisma
 * `findMany`/`count`. Never throws — an invalid or missing value falls back
 * rather than 400ing, since these two are cosmetic (worst case: page 1).
 */
export function parsePageQuery(
  page: string | undefined,
  limit: string | undefined,
  defaultLimit: number,
): ParsedPage {
  const parsedPage = parsePositiveInt(page, 1);
  const parsedLimit = Math.min(
    parsePositiveInt(limit, defaultLimit),
    MAX_LIMIT,
  );

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
    take: parsedLimit,
  };
}
