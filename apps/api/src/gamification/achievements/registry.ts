import { XpReason } from "@loomkeep/shared";
import type { PrismaService } from "../../prisma/prisma.service";

export interface AchievementCheckResult {
  unlocked: boolean;
  // Present only for achievements with a progression bar (tiered or
  // single-target) — omitted for simple on/off achievements.
  progress?: { current: number; target: number };
}

/**
 * One declarative registry entry: what unlocks it, what it grants, and
 * optional metadata for later tickets. Mirrors XP_RULES/XP_RULE_LIST's
 * shape (see xp-rules.ts) — a single lookup-by-key registry, plus an array
 * for iteration.
 */
export interface AchievementDefinition {
  key: string;
  // XP credited via XpReason.ACHIEVEMENT_UNLOCKED when this unlocks — varies
  // by rarity, see xp-rules.ts's note on this reason. Passed as
  // XpService.award's amountOverride — this reason has no fixed amount in
  // the barème registry.
  xpAward: number;
  // A tiered achievement is modelled as several registry entries sharing
  // this root (e.g. "cinephile" for cinephile_bronze/_silver/_gold) — for
  // display grouping later (G3/G5), not used by the engine itself in this
  // ticket.
  tierOf?: string;
  // Reserved for G3: the slot shows even before unlock, the name/description
  // stay hidden until then (enforced by a future screen, not here). No
  // achievement in this ticket's MVP catalogue sets this.
  secret?: boolean;
  // Reserved for G3: mirrors XpRule.socialGated. No achievement in this
  // ticket's MVP catalogue sets this.
  socialGated?: boolean;
  check(prisma: PrismaService, userId: string): Promise<AchievementCheckResult>;
}

/** "first_episode": at least one EpisodeWatch exists for the user. */
export async function checkFirstEpisode(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const watch = await prisma.episodeWatch.findFirst({
    where: { userId },
    select: { id: true },
  });
  return { unlocked: watch !== null };
}

/**
 * Shared core of the three "cinephile" tiers — only the threshold differs.
 * Movies watched = LibraryEntry rows at status COMPLETED whose MediaItem is
 * type MOVIE (see the [G2] plan's MVP catalogue).
 */
export function checkCinephileTier(target: number) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const current = await prisma.libraryEntry.count({
      where: { userId, status: "COMPLETED", mediaItem: { type: "MOVIE" } },
    });
    return { unlocked: current >= target, progress: { current, target } };
  };
}

export const ACHIEVEMENTS: Record<string, AchievementDefinition> = {
  first_episode: {
    key: "first_episode",
    xpAward: 50,
    check: checkFirstEpisode,
  },
  cinephile_bronze: {
    key: "cinephile_bronze",
    tierOf: "cinephile",
    xpAward: 50,
    check: checkCinephileTier(10),
  },
  cinephile_silver: {
    key: "cinephile_silver",
    tierOf: "cinephile",
    xpAward: 150,
    check: checkCinephileTier(50),
  },
  cinephile_gold: {
    key: "cinephile_gold",
    tierOf: "cinephile",
    xpAward: 400,
    check: checkCinephileTier(200),
  },
};

/** `ACHIEVEMENTS` as an array, for iteration (the engine, the nightly sweep, tests). */
export const ACHIEVEMENT_LIST: AchievementDefinition[] =
  Object.values(ACHIEVEMENTS);

/**
 * Which registry keys a live XP award site should re-evaluate right after
 * crediting XP for that reason — the live-wiring half of the engine (see
 * AchievementService.evaluate's callers in LibraryService). Reasons with no
 * achievement depending on them are simply absent.
 */
export const ACHIEVEMENT_KEYS_BY_XP_REASON: Partial<
  Record<XpReason, string[]>
> = {
  EPISODE_WATCHED: ["first_episode"],
  MOVIE_WATCHED: ["cinephile_bronze", "cinephile_silver", "cinephile_gold"],
};
