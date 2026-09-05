import {
  type LeaderboardDto,
  type LeaderboardEntryDto,
  type LeaderboardPeriod,
  type LeaderboardScope,
  ProfileAccess,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { avatarUrl } from "../../users/avatar.util";
import { FollowService } from "../follow.service";

// No pagination for the MVP (see the [G7] ticket) — the visible list is
// capped here, but a whole tied group at the boundary is kept together (see
// the `rank <= TOP_CUTOFF` filter below), so it can render slightly more
// than 100 rows in the rare case of a tie straddling the cutoff.
const TOP_CUTOFF = 100;

interface RankedRow {
  id: string;
  xp: number;
  rank: number;
  user: {
    username: string;
    displayName: string;
    avatarUpdatedAt: Date | null;
    profileAccess: ProfileAccess;
  };
}

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follow: FollowService,
  ) {}

  /**
   * Ranks by XP summed over the given calendar period — recomputed live from
   * the ledger every call (no snapshot table for the MVP, per the [G7]
   * ticket). GHOST and `hideProgression` accounts never appear, in either
   * scope: a leaderboard is exactly the "other viewers" a Figurant or a
   * hidden-progression account already opted out of showing XP to.
   *
   * Ranking happens in plain JS rather than a SQL window function (no raw
   * query exists anywhere else in this codebase): `groupBy` has no way to
   * order by a joined column, so the tie-break (older account wins) has to
   * happen after fetching. The candidate set is bounded by *distinct active
   * users this period*, not by ledger row count, which is the population a
   * self-hosted instance actually has — pulling it into Node to sort is the
   * simplest correct thing, not a shortcut that stops working at scale here.
   */
  async getLeaderboard(
    viewerId: string,
    scope: LeaderboardScope,
    period: LeaderboardPeriod,
  ): Promise<LeaderboardDto> {
    const { start, end } = periodRange(period);
    const candidateIds =
      scope === "friends"
        ? [viewerId, ...(await this.follow.listFriendIds(viewerId))]
        : null;

    const sums = await this.prisma.xpEntry.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: start, lt: end },
        ...(candidateIds ? { userId: { in: candidateIds } } : {}),
        user: {
          profileAccess: { not: ProfileAccess.GHOST },
          hideProgression: false,
        },
      },
      _sum: { amount: true },
    });

    if (sums.length === 0) {
      return { entries: [], viewerOutsideTop: null };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: sums.map((s) => s.userId) } },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUpdatedAt: true,
        profileAccess: true,
        createdAt: true,
      },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const sorted = sums
      .map((s) => ({
        id: s.userId,
        xp: s._sum.amount ?? 0,
        user: userById.get(s.userId)!,
      }))
      // Older account wins a tie — arbitrary but deterministic, and it's
      // what decides which of two tied rows shows the shared rank number
      // versus a dash (see LeaderboardEntryDto.rank).
      .sort(
        (a, b) =>
          b.xp - a.xp ||
          a.user.createdAt.getTime() - b.user.createdAt.getTime(),
      );

    let rank = 0;
    let previousXp: number | null = null;
    const ranked: RankedRow[] = sorted.map((row, index) => {
      if (row.xp !== previousXp) rank = index + 1;
      previousXp = row.xp;
      return { id: row.id, xp: row.xp, rank, user: row.user };
    });

    const revealedPrivateIds = await this.revealedPrivateIds(viewerId, ranked);
    const toDto = (row: RankedRow) =>
      this.toEntryDto(row, viewerId, revealedPrivateIds);

    const entries = ranked.filter((r) => r.rank <= TOP_CUTOFF).map(toDto);
    const viewerRow = ranked.find((r) => r.id === viewerId);
    const viewerOutsideTop =
      viewerRow && viewerRow.rank > TOP_CUTOFF ? toDto(viewerRow) : null;

    return { entries, viewerOutsideTop };
  }

  /**
   * A PRIVATE row's real avatar only shows to a viewer who is friends with
   * them (an accepted follow — see `computeIsFriend`'s PRIVATE branch); every
   * other viewer gets `avatarUrl: null` regardless of whether they uploaded a
   * photo, so the row looks exactly like any public account without one.
   */
  private async revealedPrivateIds(
    viewerId: string,
    rows: RankedRow[],
  ): Promise<Set<string>> {
    const privateIds = rows
      .filter(
        (r) =>
          r.user.profileAccess === ProfileAccess.PRIVATE && r.id !== viewerId,
      )
      .map((r) => r.id);
    if (privateIds.length === 0) return new Set();

    const follows = await this.prisma.follow.findMany({
      where: {
        followerId: viewerId,
        followeeId: { in: privateIds },
        status: "ACCEPTED",
      },
      select: { followeeId: true },
    });
    return new Set(follows.map((f) => f.followeeId));
  }

  private toEntryDto(
    row: RankedRow,
    viewerId: string,
    revealedPrivateIds: Set<string>,
  ): LeaderboardEntryDto {
    const isViewer = row.id === viewerId;
    const showRealAvatar =
      isViewer ||
      row.user.profileAccess !== ProfileAccess.PRIVATE ||
      revealedPrivateIds.has(row.id);

    return {
      id: row.id,
      username: row.user.username,
      displayName: row.user.displayName,
      avatarUrl: showRealAvatar
        ? avatarUrl({ id: row.id, avatarUpdatedAt: row.user.avatarUpdatedAt })
        : null,
      xp: row.xp,
      rank: row.rank,
      isViewer,
    };
  }
}

/** Calendar month/year in UTC — exported for direct testing. */
export function periodRange(
  period: LeaderboardPeriod,
  now: Date = new Date(),
): { start: Date; end: Date } {
  if (period === "month") {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
  }

  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
    end: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1)),
  };
}
