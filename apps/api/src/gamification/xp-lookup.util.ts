import type { UserSummaryDto } from "@loomkeep/shared";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * Fetches `UserScore.xp` for many users in one query — mirrors
 * `fetchStreaksByUser`'s batching shape (`stats/streak.util.ts`), used for
 * the small level badge next to pseudos in reviews/comments. A user with no
 * `XpEntry` yet has no `UserScore` row at all (only created on first credit,
 * see `XpService.recomputeScore`) — treated as 0, not absent, so a
 * brand-new account still shows "Niveau 1".
 */
export async function fetchXpByUser(
  prisma: PrismaService,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const scores = await prisma.userScore.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, xp: true },
  });

  const xpByUser = new Map(userIds.map((id) => [id, 0]));
  for (const s of scores) xpByUser.set(s.userId, s.xp);
  return xpByUser;
}

/**
 * Attaches an author's xp to their summary, gated the same way as the
 * streak badge (an anonymized author carries no badge — it would leak
 * activity the anonymisation hides) plus `hideProgression`, which the
 * author viewing their own content always bypasses (`viewerId` param — the
 * owner sees their real progress regardless of the preference). `gEnabled`
 * short-circuits everything when the instance has gamification off — no
 * `xp` field appears at all.
 *
 * `hideProgressionByUser` is deliberately not fetched via its own batched
 * lookup here (unlike `xpByUser`, from the separate `UserScore` table):
 * `hideProgression` lives on `User`, the same row the caller already reads
 * for `profileAccess`/`anonymized` — callers add `hideProgression` to that
 * existing select and build the map from those same rows, avoiding an
 * otherwise-avoidable extra Prisma query.
 */
export function withXp(
  author: UserSummaryDto,
  viewerId: string,
  xpByUser: Map<string, number>,
  gEnabled: boolean,
  hideProgressionByUser: Map<string, boolean>,
): UserSummaryDto {
  if (!gEnabled || author.anonymized) return author;

  if (author.id !== viewerId && hideProgressionByUser.get(author.id)) {
    return author;
  }

  return { ...author, xp: xpByUser.get(author.id) ?? 0 };
}
