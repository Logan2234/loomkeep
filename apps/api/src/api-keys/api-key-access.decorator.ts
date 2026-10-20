import type { ApiKeyResource } from "@loomkeep/shared";
import { SetMetadata } from "@nestjs/common";

export const API_KEY_ACCESS_KEY = "apiKeyAccess";

export interface ApiKeyAccess {
  /** Null for a route every key may call, whatever it was granted. */
  resource: ApiKeyResource | null;
}

/**
 * Opens a route to API keys. Every other route refuses them, so a new
 * endpoint can never become reachable through a key by omission.
 */
export const AllowApiKey = (resource: ApiKeyResource | null = null) =>
  SetMetadata(API_KEY_ACCESS_KEY, { resource } satisfies ApiKeyAccess);
