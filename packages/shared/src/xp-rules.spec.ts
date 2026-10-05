import { describe, expect, it } from "vitest";
import { XpReason } from "./enums";
import {
  bookFinishedXp,
  gameFinishedXp,
  readingGoalXp,
  replayXp,
  sagaCompletionXp,
  seasonCompletedXp,
  seriesCompletedXp,
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

  it("pays a finished book by its length, the flat amount when unknown", () => {
    expect(bookFinishedXp(48)).toBe(66);
    expect(bookFinishedXp(330)).toBe(160);
    expect(bookFinishedXp(1500)).toBe(400);
    expect(bookFinishedXp(null)).toBe(150);
  });

  it("pays a finished game by its time to beat, the flat amount when unknown", () => {
    expect(gameFinishedXp(3 * 60)).toBe(124);
    expect(gameFinishedXp(30 * 60)).toBe(340);
    expect(gameFinishedXp(100 * 60)).toBe(700);
    expect(gameFinishedXp(null)).toBe(350);
  });

  it("pays a season by its episodes and a series by its seasons", () => {
    expect(seasonCompletedXp(3)).toBe(10);
    expect(seasonCompletedXp(12)).toBe(24);
    expect(seasonCompletedXp(50)).toBe(60);
    expect(seriesCompletedXp(1)).toBe(75);
    expect(seriesCompletedXp(4)).toBe(150);
    expect(seriesCompletedXp(20)).toBe(300);
  });

  it("pays a replay half its first finish, matching the flat fallbacks", () => {
    expect(replayXp(bookFinishedXp(null))).toBe(XP_RULES.BOOK_REPLAYED.amount);
    expect(replayXp(gameFinishedXp(null))).toBe(XP_RULES.GAME_REPLAYED.amount);
  });
});
