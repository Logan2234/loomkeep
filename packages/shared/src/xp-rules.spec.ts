import { describe, expect, it } from "vitest";
import { XpReason } from "./enums";
import {
  readingGoalXp,
  sagaCompletionXp,
  XP_RULE_LIST,
  XP_RULES,
} from "./xp-rules";

describe("XP_RULES", () => {
  it("has a registry entry for every XpReason", () => {
    for (const reason of Object.values(XpReason)) {
      expect(XP_RULES[reason]).toBeDefined();
      expect(XP_RULES[reason].reason).toBe(reason);
    }
  });

  it("defines a fixed amount for every reason except the per-grant ones", () => {
    // These pass XpService.award's amountOverride instead — see xp-rules.ts's
    // doc comment on XpRule.amount.
    const noFixedAmount = new Set<XpReason>([
      XpReason.ADMIN_ADJUSTMENT,
      XpReason.ACHIEVEMENT_UNLOCKED,
      XpReason.SAGA_COMPLETED,
      XpReason.READING_GOAL_REACHED,
    ]);

    for (const rule of Object.values(XP_RULES)) {
      if (noFixedAmount.has(rule.reason)) {
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
    // Milestones are unique by nature — DOMAIN_STARTED/IMPORT_COMPLETED dedup
    // per domain, PROFILE_COMPLETED per user, ACHIEVEMENT_UNLOCKED per
    // achievement id, SAGA_COMPLETED per saga, READING_GOAL_REACHED per goal —
    // so the XpEntry unique index alone prevents a repeat and no dailyCap is
    // needed.
    const uncapped = new Set<XpReason>([
      XpReason.DOMAIN_STARTED,
      XpReason.IMPORT_COMPLETED,
      XpReason.PROFILE_COMPLETED,
      XpReason.ACHIEVEMENT_UNLOCKED,
      XpReason.SAGA_COMPLETED,
      XpReason.READING_GOAL_REACHED,
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

  it("exposes the same rules as a list, for callers that iterate", () => {
    expect(XP_RULE_LIST).toHaveLength(Object.keys(XP_RULES).length);
    expect(XP_RULE_LIST.map((r) => r.reason).sort()).toEqual(
      Object.values(XpReason).sort(),
    );
  });
});

describe("progressive XP", () => {
  it("pays a long saga more per work than a short one, up to a cap", () => {
    expect(sagaCompletionXp(2)).toBe(60);
    expect(sagaCompletionXp(3)).toBe(105);
    expect(sagaCompletionXp(8)).toBe(480);
    expect(sagaCompletionXp(8) / 8).toBeGreaterThan(sagaCompletionXp(2) / 2);
    expect(sagaCompletionXp(41)).toBe(1000);
  });

  it("pays a bigger reading goal more per book, up to a cap", () => {
    expect(readingGoalXp(3)).toBe(72);
    expect(readingGoalXp(12)).toBe(612);
    expect(readingGoalXp(20)).toBe(1500);
    expect(readingGoalXp(50)).toBe(1500);
  });
});
