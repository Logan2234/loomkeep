import { browser } from "$app/environment";
import type { AuthTokensDto, UserDto } from "@loomkeep/shared";

const STORAGE_KEY = "loomkeep.tokens";

/** Global auth state (Svelte 5 runes). Tokens persist in localStorage. */
class AuthState {
  user = $state<UserDto | null>(null);
  accessToken = $state<string | null>(null);
  refreshToken = $state<string | null>(null);

  get isLoggedIn(): boolean {
    return this.user !== null;
  }

  /** Whether the current user has the ADMIN role (gates /admin). */
  get isAdmin(): boolean {
    return this.user?.role === "ADMIN";
  }

  /**
   * The `jti` of the current refresh token, read from its (unverified) payload.
   * Used to flag the current device in the sessions list. Null if unavailable.
   */
  get currentSessionJti(): string | null {
    if (!this.refreshToken) return null;

    try {
      const payload = this.refreshToken.split(".")[1];
      // base64url → base64, then decode and parse.
      const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      const claims = JSON.parse(json) as { jti?: string };
      return claims.jti ?? null;
    } catch {
      return null;
    }
  }

  loadTokens(): void {
    if (!browser) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const tokens = JSON.parse(raw) as AuthTokensDto;
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  setTokens(tokens: AuthTokensDto): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;

    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    }
  }

  clear(): void {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;

    if (browser) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export const auth = new AuthState();
