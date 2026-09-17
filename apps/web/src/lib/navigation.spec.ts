import { describe, expect, it } from "vitest";
import { resolveShortcutChoices } from "./navigation";

describe("mobile shortcut choices", () => {
  it("includes social destinations when their features are available", () => {
    const choices = resolveShortcutChoices({
      isDomainEnabled: () => true,
      isAdmin: false,
      socialEnabled: true,
      gamificationEnabled: true,
    });

    expect(choices.map((choice) => choice.id)).toEqual([
      "home",
      "search",
      "media",
      "games",
      "books",
      "music",
      "calendar",
      "stats",
      "leaderboard",
      "feed",
      "profile",
      "settings",
      "admin",
    ]);
  });
});
