// Client-side shaping of GET /achievements: the API returns one row per
// registry key, the screen shows one card per tiered family (see the [G5]
// design notes — ~42 cards for the 66 catalogue entries).
import type {
  AchievementDto,
  AchievementFamily,
  AchievementTier,
} from "@loomkeep/shared";

/** Section order of the page. Mirrors ACHIEVEMENT_FAMILIES on the API side. */
const FAMILY_ORDER: AchievementFamily[] = [
  "volume",
  "ritual",
  "exploration",
  "completion",
  "seasonal",
  "social",
  "account",
  "misc",
];

const TIER_RANK: Record<AchievementTier, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
};

export interface AchievementGroup {
  /** `tierOf` for a tiered family, the key otherwise, synthetic for a masked secret. */
  id: string;
  family: AchievementFamily;
  /** A still-locked secret: only its family is known (the API masks the rest). */
  masked: boolean;
  /** Bronze → gold for a tiered family, a single element otherwise. */
  entries: AchievementDto[];
  unlockedCount: number;
  /**
   * The tier actually reached, which is what the medallion ring shows — not
   * the family's maximum. An untiered achievement that is unlocked counts as
   * gold, so a single-tier card still reads as "earned" at a glance.
   */
  reachedTier: AchievementTier | null;
  /** The next entry left to earn — what the rail, the XP figure and the note describe. */
  next: AchievementDto | null;
  xpEarned: number;
}

export interface FamilySection {
  family: AchievementFamily;
  groups: AchievementGroup[];
  unlockedEntries: number;
  totalEntries: number;
}

export interface CatalogueSummary {
  unlocked: number;
  total: number;
  /** 0–1, for the hero rail. */
  ratio: number;
  xpEarned: number;
  secretsFound: number;
  secretsTotal: number;
  familyCount: number;
  /** Most recent unlocks first, at most three — the stacked medallions. */
  recent: AchievementDto[];
}

function rank(entry: AchievementDto): number {
  return entry.tier ? TIER_RANK[entry.tier] : 0;
}

function buildGroup(id: string, entries: AchievementDto[]): AchievementGroup {
  const ordered = [...entries].sort((a, b) => rank(a) - rank(b));
  const unlocked = ordered.filter((e) => e.unlocked);
  const highest = unlocked.at(-1);

  return {
    id,
    family: ordered[0].family,
    masked: ordered[0].key === null,
    entries: ordered,
    unlockedCount: unlocked.length,
    reachedTier: highest ? (highest.tier ?? "gold") : null,
    next: ordered.find((e) => !e.unlocked) ?? null,
    xpEarned: unlocked.reduce((sum, e) => sum + (e.xpAward ?? 0), 0),
  };
}

/**
 * One card per `tierOf` family, keeping the API's (registry) order. Masked
 * secrets each get their own synthetic id: with `key` and `tierOf` both
 * nulled out, nothing is left to group them by — and no secret in the
 * catalogue is tiered today anyway.
 */
export function groupAchievements(list: AchievementDto[]): AchievementGroup[] {
  const buckets = new Map<string, AchievementDto[]>();
  let maskedCount = 0;

  for (const entry of list) {
    const id =
      entry.key === null
        ? `secret-${maskedCount++}`
        : (entry.tierOf ?? entry.key);
    const bucket = buckets.get(id);

    if (bucket) bucket.push(entry);
    else buckets.set(id, [entry]);
  }

  return [...buckets].map(([id, entries]) => buildGroup(id, entries));
}

/** Groups split into the page's family sections, empty families dropped. */
export function sectionsByFamily(groups: AchievementGroup[]): FamilySection[] {
  return FAMILY_ORDER.map((family) => {
    const familyGroups = groups.filter((g) => g.family === family);
    const entries = familyGroups.flatMap((g) => g.entries);

    return {
      family,
      groups: familyGroups,
      unlockedEntries: entries.filter((e) => e.unlocked).length,
      totalEntries: entries.length,
    };
  }).filter((section) => section.groups.length > 0);
}

/** The hero band's figures, counted over individual entries, not cards. */
export function summarize(list: AchievementDto[]): CatalogueSummary {
  const unlocked = list.filter((e) => e.unlocked);
  const secrets = list.filter((e) => e.secret);

  return {
    unlocked: unlocked.length,
    total: list.length,
    ratio: list.length === 0 ? 0 : unlocked.length / list.length,
    xpEarned: unlocked.reduce((sum, e) => sum + (e.xpAward ?? 0), 0),
    secretsFound: secrets.filter((e) => e.unlocked).length,
    secretsTotal: secrets.length,
    familyCount: new Set(list.map((e) => e.family)).size,
    recent: [...unlocked]
      .sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""))
      .slice(0, 3),
  };
}
