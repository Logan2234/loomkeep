import type { PrismaService } from "../prisma/prisma.service";
import type { SessionCacheService } from "./session-cache.service";

/**
 * Whether `sessionId` still names a live `RefreshToken` row, using
 * SessionCacheService's short-lived cache to spare the database on the
 * common case. Shared between JwtAuthGuard (REST) and EventsGateway (WS
 * handshake) so a revoked session is rejected the same way on both.
 */
export async function isSessionLive(
  prisma: PrismaService,
  sessionCache: SessionCacheService,
  sessionId: string,
): Promise<boolean> {
  if (sessionCache.isKnownLive(sessionId)) return true;

  const session = await prisma.refreshToken.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return false;

  sessionCache.markLive(sessionId);
  return true;
}
