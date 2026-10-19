export const JWT_ALGORITHM = "HS256" as const;
export const JWT_ISSUER = "loomkeep-api";
export const JWT_ACCESS_AUDIENCE = "loomkeep-web";
export const JWT_REFRESH_AUDIENCE = "loomkeep-refresh";
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;
/**
 * How long a just-rotated refresh token still reads as "another tab beat
 * you to it" rather than a replay: every tab shares the cookies, so they
 * all expire at once and refresh within milliseconds of each other.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;
