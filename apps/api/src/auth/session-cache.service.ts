import { Injectable } from "@nestjs/common";

// Long enough to spare the database a query on every authenticated request,
// short enough that a forced logout (admin "forcer la déconnexion", the
// user's own revoke actions, logout, password reset) is never masked by a
// stale positive for more than a few seconds beyond the explicit
// invalidation those callers already perform.
const CACHE_TTL_MS = 30_000;

/**
 * Short-lived cache of "this session id (RefreshToken.id) is still live",
 * backing JwtAuthGuard's per-request check without hitting the database each
 * time. A session is trusted as live for CACHE_TTL_MS after the last DB
 * confirmation; revocation (AuthService's revoke methods, logout, and
 * resetPassword) proactively evicts the affected id(s) so the access token
 * stops working immediately rather than waiting out the TTL.
 */
@Injectable()
export class SessionCacheService {
  private readonly liveUntil = new Map<string, number>();

  isKnownLive(sessionId: string): boolean {
    const expiresAt = this.liveUntil.get(sessionId);
    if (expiresAt === undefined) return false;

    if (expiresAt <= Date.now()) {
      this.liveUntil.delete(sessionId);
      return false;
    }

    return true;
  }

  markLive(sessionId: string): void {
    this.liveUntil.set(sessionId, Date.now() + CACHE_TTL_MS);
  }

  invalidate(sessionId: string): void {
    this.liveUntil.delete(sessionId);
  }

  invalidateAll(sessionIds: Iterable<string>): void {
    for (const sessionId of sessionIds) this.liveUntil.delete(sessionId);
  }
}
