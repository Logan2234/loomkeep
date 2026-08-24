import { browser } from "$app/environment";
import type { AuthTokensDto, UserDto } from "@loomkeep/shared";

const STORAGE_KEY = "loomkeep.tokens";

/** Global auth state (Svelte 5 runes). Tokens persist in localStorage. */
class AuthState {
  user = $state<UserDto | null>(null);
  accessToken = $state<string | null>(null);
  refreshToken = $state<string | null>(null);
  /** The real plan (not the `premium-features`-gated effective status) — see `getMyEntitlement`. */
  isPremium = $state(false);

  // $derived (not a plain getter) so effects that read these only re-run when
  // the boolean itself flips — not on every `user` reassignment (e.g. every
  // settings mutation re-sets `auth.user` to a fresh object with the same
  // login/role status). A plain getter re-reads the `user` signal on every
  // access, so an effect depending on it would rerun on those reassignments
  // too, even though its own dependency (this boolean) never changed.
  isLoggedIn = $derived(this.user !== null);

  /** Whether the current user has the ADMIN role (gates /admin). */
  isAdmin = $derived(this.user?.role === "ADMIN");

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
    this.isPremium = false;

    if (browser) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export const auth = new AuthState();
