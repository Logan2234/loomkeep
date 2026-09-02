import { XP_RULES, XpReason } from "@loomkeep/shared";

describe("XP_RULES", () => {
  it("has a registry entry for every XpReason", () => {
    for (const reason of Object.values(XpReason)) {
      expect(XP_RULES[reason]).toBeDefined();
      expect(XP_RULES[reason].reason).toBe(reason);
    }
  });

  it("defines a fixed amount for every reason except ADMIN_ADJUSTMENT", () => {
    for (const rule of Object.values(XP_RULES)) {
      if (rule.reason === XpReason.ADMIN_ADJUSTMENT) {
        expect(rule.amount).toBeUndefined();
      } else {
        expect(rule.amount).toBeGreaterThan(0);
      }
    }
  });

  it("marks the discussion reasons as socialGated, and nothing else", () => {
    const gated = new Set<XpReason>([
      XpReason.COMMENT_POSTED,
      XpReason.REVIEW_VOTE_RECEIVED,
      XpReason.COMMENT_REACTION_RECEIVED,
      XpReason.LIST_CREATED,
    ]);

    for (const rule of Object.values(XP_RULES)) {
      expect(rule.socialGated).toBe(gated.has(rule.reason));
    }
  });

  it("caps every repeatable reason, and leaves the unique milestones uncapped", () => {
    // Milestones (see the plan's "Jalons" table, which carries no Plafond
    // column at all): each is unique by nature — DOMAIN_STARTED/
    // IMPORT_COMPLETED dedup per domain, PROFILE_COMPLETED per user,
    // ONBOARDING_STEP/ACHIEVEMENT_UNLOCKED per step/achievement id — so the
    // XpEntry unique constraint alone prevents a repeat, no dailyCap needed.
    const uncapped = new Set<XpReason>([
      XpReason.DOMAIN_STARTED,
      XpReason.IMPORT_COMPLETED,
      XpReason.ONBOARDING_STEP,
      XpReason.PROFILE_COMPLETED,
      XpReason.ACHIEVEMENT_UNLOCKED,
    ]);

    for (const rule of Object.values(XP_RULES)) {
      if (
        uncapped.has(rule.reason) ||
        rule.reason === XpReason.ADMIN_ADJUSTMENT
      ) {
        expect(rule.dailyCap).toBeUndefined();
      } else {
        expect(rule.dailyCap).toBeGreaterThan(0);
      }
    }
  });
});
