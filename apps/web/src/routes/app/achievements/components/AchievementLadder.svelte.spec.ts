import { renderWithQuery } from "#lib/test/render.js";
import type { AchievementDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { AchievementGroup } from "../achievements";
import { rarityLabel, rarityPercent } from "../labels";
import AchievementLadder from "./AchievementLadder.svelte";

function tier(
  tierName: "bronze" | "silver" | "gold",
  rarity: AchievementDto["rarity"],
): AchievementDto {
  return {
    key: `cinephile_${tierName}`,
    family: "volume",
    tierOf: "cinephile",
    tier: tierName,
    xpAward: 50,
    secret: false,
    unlocked: false,
    unlockedAt: null,
    progress: { current: 3, target: 10 },
    equipped: false,
    rarity,
  };
}

describe("AchievementLadder", () => {
  it("gives each tier its own share of members, and none where the instance can't say", () => {
    const bronze = { percent: 45, upperBound: false };
    const gold = { percent: 3, upperBound: true };
    const entries = [
      tier("bronze", bronze),
      tier("silver", null),
      tier("gold", gold),
    ];

    const { container } = renderWithQuery(AchievementLadder, {
      group: {
        entries,
        next: entries[0],
        reachedTier: null,
      } as unknown as AchievementGroup,
      equippedCount: 0,
    });

    expect(screen.getByText(rarityPercent(bronze))).toBeTruthy();
    expect(screen.getByText(rarityPercent(gold))).toBeTruthy();
    // The compact figure is hidden from screen readers; the sentence isn't.
    expect(screen.getByText(rarityLabel(bronze)!)).toBeTruthy();
    expect(screen.getByText(rarityLabel(gold)!)).toBeTruthy();
    // Silver has no share: its cell stays empty, keeping the columns aligned.
    expect(container.querySelectorAll("span[title]")).toHaveLength(2);
  });
});
