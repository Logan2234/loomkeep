import { renderWithQuery } from "$lib/test/render";
import type { AchievementDto } from "@loomkeep/shared";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AchievementGroup } from "../achievements";
import AchievementCard from "./AchievementCard.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

const entry: AchievementDto = {
  key: "one_sided",
  family: "social",
  tierOf: null,
  tier: null,
  xpAward: 50,
  secret: false,
  unlocked: true,
  unlockedAt: "2026-09-28T10:00:00.000Z",
  progress: null,
  equipped: false,
  rarity: null,
} as unknown as AchievementDto;

const group = {
  id: "one_sided",
  family: "social",
  masked: false,
  entries: [entry],
  unlockedCount: 1,
  reachedTier: "gold",
  next: null,
  xpEarned: 50,
} as unknown as AchievementGroup;

afterEach(() => vi.restoreAllMocks());

describe("AchievementCard", () => {
  it("scrolls to the linked card after the navigation has reset the page to the top", async () => {
    // A card already in cache mounts during the navigation itself, and
    // SvelteKit then scrolls to the top: a scroll issued at mount is undone.
    const calls: string[] = [];
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {
      calls.push("card");
    });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {
      calls.push("top");
    });

    renderWithQuery(AchievementCard, {
      group,
      highlighted: true,
      equippedCount: 0,
    });
    await tick();
    window.scrollTo(0, 0); // the router's own reset, right after the render
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(calls).toEqual(["top", "card"]);
  });
});
