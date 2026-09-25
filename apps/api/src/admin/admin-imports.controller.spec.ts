import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminImportsController } from "./admin-imports.controller";

function makeController() {
  const prisma = {
    importRun: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return {
    controller: new AdminImportsController(prisma as unknown as PrismaService),
    prisma,
  };
}

function run(id: string) {
  return {
    id,
    userId: "user-1",
    user: { email: "user@example.com" },
    sourceId: "myanimelist",
    status: "SUCCESS",
    itemCount: 2,
    overwrite: false,
    summary: "Imported 2 items",
    error: null,
    startedAt: new Date("2026-09-01T10:00:00.000Z"),
    finishedAt: new Date("2026-09-01T10:01:00.000Z"),
  };
}

describe("AdminImportsController.listImportRuns", () => {
  it("applies filters and fetches one extra row to signal the next page", async () => {
    const { controller, prisma } = makeController();
    prisma.importRun.findMany.mockResolvedValue([run("1"), run("2"), run("3")]);

    const result = await controller.listImportRuns(
      " myanimelist ",
      "SUCCESS",
      " user-1 ",
      "2",
      "2",
    );

    expect(prisma.importRun.findMany).toHaveBeenCalledWith({
      where: {
        sourceId: "myanimelist",
        status: "SUCCESS",
        userId: "user-1",
      },
      include: { user: { select: { email: true } } },
      orderBy: { startedAt: "desc" },
      skip: 2,
      take: 3,
    });
    expect(result.hasMore).toBe(true);
    expect(result.items.map((item) => item.id)).toEqual(["1", "2"]);
    expect(result.items[0]).toMatchObject({
      identifier: "user@example.com",
      startedAt: "2026-09-01T10:00:00.000Z",
    });
  });

  it("does not invent an account identifier after the account is deleted", async () => {
    const { controller, prisma } = makeController();
    prisma.importRun.findMany.mockResolvedValue([
      { ...run("orphaned"), userId: null, user: null },
    ]);

    const result = await controller.listImportRuns();

    expect(result.hasMore).toBe(false);
    expect(result.items[0]).toMatchObject({
      userId: null,
      identifier: null,
    });
  });
});
