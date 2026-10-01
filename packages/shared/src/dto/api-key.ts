/**
 * What an API key can be granted access to. The public API (`/api/v1`) only
 * reads for now; a scope is `<resource>:read`, leaving room for
 * `<resource>:write` without reshaping stored keys.
 */
export const API_KEY_RESOURCES = [
  "library",
  "lists",
  "calendar",
  "stats",
  "reviews",
  "profile",
  "notifications",
  "export",
] as const;
export type ApiKeyResource = (typeof API_KEY_RESOURCES)[number];
export type ApiKeyScope = `${ApiKeyResource}:read`;

export const API_KEY_SCOPES: readonly ApiKeyScope[] = API_KEY_RESOURCES.map(
  (resource) => `${resource}:read` as const,
);

/** Every secret starts with it, so a leaked key is recognisable at a glance. */
export const API_KEY_PREFIX = "lk_";

export const API_KEY_NAME_MAX_LENGTH = 60;

/**
 * A safety net against a runaway script, not a product limit: the request
 * quota is what actually bounds usage. Never shown until reached.
 */
export const MAX_API_KEYS_PER_USER = 100;

/**
 * Requests per minute on the public API, per account (every key and session
 * together). Premium raises it once the `premium-features` flag is on.
 */
export const API_RATE_LIMITS = { free: 60, premium: 300 } as const;

export interface ApiKeyQuotaDto {
  perMinute: number;
  /** What premium would raise it to; null when there's nothing to upgrade to. */
  premiumPerMinute: number | null;
}

export interface ApiKeyDto {
  id: string;
  name: string;
  /** Last characters of the secret, to tell keys apart without revealing them. */
  suffix: string;
  scopes: ApiKeyScope[];
  /** ISO datetime; null for a key that never expires. */
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
}

export interface CreateApiKeyDto {
  name: string;
  scopes: ApiKeyScope[];
  /** ISO datetime in the future, or null for a key that never expires. */
  expiresAt: string | null;
}

/** The only response that ever carries the secret. */
export interface CreatedApiKeyDto {
  apiKey: ApiKeyDto;
  secret: string;
}

/** `GET /api/v1/me` — lets a script check which account and key it runs as. */
export interface ApiV1MeDto {
  user: {
    id: string;
    username: string;
    displayName: string;
  };
  /** Null when the request was authenticated by a browser session instead. */
  apiKey: {
    name: string;
    scopes: ApiKeyScope[];
    expiresAt: string | null;
  } | null;
  rateLimit: { perMinute: number };
}
