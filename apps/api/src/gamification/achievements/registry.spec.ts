import { vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import { checkCinephileTier, checkFirstEpisode } from "./registry";

describe("checkFirstEpisode", () => {
  it("unlocks once at least one EpisodeWatch exists", async () => {
    const prisma = {
      episodeWatch: { findFirst: vi.fn().mockResolvedValue({ id: "w1" }) },
    } as unknown as PrismaService;

    await expect(checkFirstEpisode(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("stays locked with no EpisodeWatch", async () => {
    const prisma = {
      episodeWatch: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    await expect(checkFirstEpisode(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
    });
  });
});

describe("checkCinephileTier", () => {
  it("unlocks once the movie count reaches the tier's target, and reports progress either way", async () => {
    const count = vi.fn().mockResolvedValue(10);
    const prisma = { libraryEntry: { count } } as unknown as PrismaService;

    await expect(checkCinephileTier(10)(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 10, target: 10 },
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: "COMPLETED",
        mediaItem: { type: "MOVIE" },
      },
    });

    await expect(checkCinephileTier(50)(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
      progress: { current: 10, target: 50 },
    });
  });
});
