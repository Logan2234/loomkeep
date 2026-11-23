import type { Prisma } from "@prisma/client";
import type { EventsGateway } from "../events/events.gateway";
import type { PrismaService } from "../prisma/prisma.service";
import type { SessionCacheService } from "./session-cache.service";

/**
 * Ends the sessions `where` matches, in one transaction with `changes` (the
 * password or MFA change that calls for it), and then everything else a
 * session holds: its cached "still live" answer, or its access token keeps
 * working up to SessionCacheService's TTL, and its open socket, or it keeps
 * receiving pushes until the token expires. Deleting the rows alone did only
 * the first part.
 */
export async function revokeSessionsWith(
  deps: {
    prisma: PrismaService;
    sessionCache: SessionCacheService;
    events: EventsGateway;
  },
  where: Prisma.RefreshTokenWhereInput,
  changes: Prisma.PrismaPromise<unknown>[] = [],
): Promise<void> {
  // Read first: deleteMany doesn't say which rows it removed.
  const sessions = await deps.prisma.refreshToken.findMany({
    where,
    select: { id: true },
  });
  await deps.prisma.$transaction([
    ...changes,
    deps.prisma.refreshToken.deleteMany({ where }),
  ]);

  const ids = sessions.map((s) => s.id);
  deps.sessionCache.invalidateAll(ids);
  ids.forEach((id) => deps.events.disconnectSession(id));
}

/** Every session of the user but the current one (all of them without one). */
export const otherSessions = (
  userId: string,
  currentSessionId?: string,
): Prisma.RefreshTokenWhereInput =>
  currentSessionId ? { userId, id: { not: currentSessionId } } : { userId };
