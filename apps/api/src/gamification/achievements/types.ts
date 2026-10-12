import { type AchievementFamily, type AchievementTier } from "@loomkeep/shared";

import type { PrismaService } from "../../prisma/prisma.service";

export interface AchievementCheckResult {
  unlocked: boolean;
  // Present only for achievements with a progression bar (tiered or
  // single-target) — omitted for simple on/off achievements.
  progress?: { current: number; target: number };
}

/**
 * One declarative registry entry: what unlocks it and what it grants.
 * Mirrors XP_RULES/XP_RULE_LIST's
 * shape (see xp-rules.ts) — a single lookup-by-key registry, plus an array
 * for iteration.
 */
export interface AchievementDefinition {
  key: string;
  // Which screen section this belongs to. Every
  // entry has one, secrets included — "secret" is an orthogonal trait, never
  // a family.
  family: AchievementFamily;
  // XP credited via XpReason.ACHIEVEMENT_UNLOCKED when this unlocks — varies
  // by rarity, see xp-rules.ts's note on this reason. Passed as
  // XpService.award's amountOverride — this reason has no fixed amount in
  // the barème registry.
  xpAward: number;
  // A tiered achievement is modelled as several registry entries sharing
  // this root (e.g. "cinephile" for cinephile_bronze/_silver/_gold) — for
  // display grouping, not used by the engine itself.
  tierOf?: string;
  // Which tier of its `tierOf` family this entry is — declared explicitly,
  // never derived by parsing the key's suffix. Absent on untiered entries.
  tier?: AchievementTier;
  // The slot shows before unlock while its name and description stay hidden.
  secret?: boolean;
  // Mirrors XpRule.socialGated for the whole Social family.
  socialGated?: boolean;
  check(prisma: PrismaService, userId: string): Promise<AchievementCheckResult>;
}
