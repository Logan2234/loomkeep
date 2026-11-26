import type { PrismaService } from "../../../prisma/prisma.service";
import { checkWorldTourTier } from "./media";

function prismaWith(countriesPerEntry: string[][]) {
  const findMany = vi.fn().mockResolvedValue(
    countriesPerEntry.map((originCountries) => ({
      mediaItem: { originCountries },
    })),
  );
  return {
    prisma: { mediaEntry: { findMany } } as unknown as PrismaService,
    findMany,
  };
}

describe("checkWorldTourTier", () => {
  it("counts each country once, a co-production for each of its countries", async () => {
    const { prisma } = prismaWith([["FR"], ["FR", "BE"], ["KR"], []]);

    const result = await checkWorldTourTier(5)(prisma, "user-1");

    expect(result).toEqual({
      unlocked: false,
      progress: { current: 3, target: 5 },
    });
  });

  it("only reads finished titles", async () => {
    const { prisma, findMany } = prismaWith([]);

    await checkWorldTourTier(5)(prisma, "user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", status: "COMPLETED" },
      }),
    );
  });

  it("unlocks once the target is reached", async () => {
    const { prisma } = prismaWith([["US"], ["GB"], ["JP"], ["KR"], ["DE"]]);

    const result = await checkWorldTourTier(5)(prisma, "user-1");

    expect(result.unlocked).toBe(true);
  });
});
