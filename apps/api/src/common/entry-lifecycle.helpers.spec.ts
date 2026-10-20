import { XpReason } from "@loomkeep/shared";
import { vi } from "vitest";
import { stubAchievements, stubXp } from "../test-utils/stubs";
import { AppException } from "./app.exception";
import {
  assertSessionOwnership,
  revokeEntryXp,
  syncCycleCompletionXp,
} from "./entry-lifecycle.util";

describe("shared session ownership", () => {
  it("returns the single loaded row and preserves missing/foreign error statuses", async () => {
    const row = { bookEntry: { userId: "owner" } };
    const finder = vi.fn<() => Promise<typeof row>>().mockResolvedValue(row);
    expect(
      await assertSessionOwnership(
        "owner",
        finder,
        (session) => session.bookEntry.userId,
      ),
    ).toBe(row);
    expect(finder).toHaveBeenCalledTimes(1);
    await expect(
      assertSessionOwnership(
        "other",
        finder,
        (session) => session.bookEntry.userId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      assertSessionOwnership(
        "owner",
        async () => null,
        () => "owner",
      ),
    ).rejects.toBeInstanceOf(AppException);
  });
});

describe("cycle and entry XP", () => {
  const args = {
    userId: "owner",
    previousStatus: "PLAYING",
    nextStatus: "COMPLETED",
    completedStatus: "COMPLETED",
    cycle: { id: "cycle-1", number: 1 },
    sourceType: "GamePlaythrough" as const,
    firstReason: XpReason.GAME_FINISHED,
    replayReason: XpReason.GAME_REPLAYED,
  };
  it("credits first and replay completions with the caller's amount", async () => {
    const xp = stubXp();
    const achievements = stubAchievements();
    expect(
      await syncCycleCompletionXp(xp, achievements, {
        ...args,
        amount: async () => 125,
      }),
    ).toBe(true);
    expect(xp.award).toHaveBeenCalledWith(
      "owner",
      XpReason.GAME_FINISHED,
      "cycle-1",
      125,
    );
    await syncCycleCompletionXp(xp, achievements, {
      ...args,
      cycle: { id: "cycle-2", number: 2 },
    });
    expect(xp.award).toHaveBeenCalledWith(
      "owner",
      XpReason.GAME_REPLAYED,
      "cycle-2",
    );
    expect(achievements.evaluate).toHaveBeenCalledTimes(2);
  });
  it("revokes when leaving completion and does nothing for unchanged/missing cycles", async () => {
    const xp = stubXp();
    const achievements = stubAchievements();
    expect(
      await syncCycleCompletionXp(xp, achievements, {
        ...args,
        previousStatus: "COMPLETED",
        nextStatus: "PLAYING",
      }),
    ).toBe(false);
    expect(xp.revokeBySource).toHaveBeenCalledWith("GamePlaythrough", [
      "cycle-1",
    ]);
    await syncCycleCompletionXp(xp, achievements, {
      ...args,
      previousStatus: "COMPLETED",
    });
    await syncCycleCompletionXp(xp, achievements, { ...args, cycle: null });
    expect(xp.award).not.toHaveBeenCalled();
    expect(achievements.evaluate).not.toHaveBeenCalled();
  });
  it("awaits revocations in the domain's specified order", async () => {
    const xp = stubXp();
    const order: string[] = [];
    vi.mocked(xp.revokeBySource).mockImplementation(async (source) => {
      await Promise.resolve();
      order.push(source);
    });
    await revokeEntryXp(xp, [
      { sourceType: "MusicEntry", ids: ["entry"] },
      { sourceType: "Entry", ids: ["entry"] },
      { sourceType: "Review", ids: ["review"] },
    ]);
    expect(order).toEqual(["MusicEntry", "Entry", "Review"]);
  });
});
