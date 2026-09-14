import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { BlockService } from "./block.service";

const A = "user-a";
const B = "user-b";

function make(rows: { id?: string; blockerId?: string }[] = []) {
  const prisma = {
    block: {
      findUnique: vi.fn().mockResolvedValue(rows[0] ?? null),
      findFirst: vi.fn().mockResolvedValue(rows[0] ?? null),
      findMany: vi.fn().mockResolvedValue(rows),
    },
  } as unknown as PrismaService;

  return { service: new BlockService(prisma), prisma };
}

describe("BlockService.isBlocked", () => {
  it("is directional: it answers for that blocker only", async () => {
    const { service, prisma } = make([{ id: "b1" }]);

    await service.isBlocked(A, B);

    expect(prisma.block.findUnique).toHaveBeenCalledWith({
      where: { blockerId_blockedId: { blockerId: A, blockedId: B } },
    });
  });

  it("returns false when that particular block does not exist", async () => {
    const { service } = make();

    expect(await service.isBlocked(A, B)).toBe(false);
  });
});

describe("BlockService.isBlockedEitherWay", () => {
  it("matches a block in either direction", async () => {
    const { service, prisma } = make([{ id: "b1" }]);

    expect(await service.isBlockedEitherWay(A, B)).toBe(true);
    expect(prisma.block.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { blockerId: A, blockedId: B },
          { blockerId: B, blockedId: A },
        ],
      },
      select: { id: true },
    });
  });

  it("returns false when neither user blocked the other", async () => {
    const { service } = make();

    expect(await service.isBlockedEitherWay(A, B)).toBe(false);
  });
});

describe("BlockService.findBlocksBetween", () => {
  it("returns the rows themselves, so the caller can tell who blocked whom", async () => {
    // VisibilityService reads blockerId off these to separate `blocking`
    // from `blockedByTarget` — a boolean here would lose that distinction.
    const { service } = make([{ id: "b1", blockerId: B }]);

    const blocks = await service.findBlocksBetween(A, B);

    expect(blocks).toEqual([{ id: "b1", blockerId: B }]);
  });
});
