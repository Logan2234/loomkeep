import { vi } from "vitest";
import type { ImportJobService } from "../import/import-job.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminImportsController } from "./admin-imports.controller";

function makeController() {
  const prisma = {
    importRun: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
  };
  const imports = {
    listRunningImports: vi.fn().mockReturnValue([]),
    runningImportDetails: vi.fn(),
  };
  return {
    imports,
    controller: new AdminImportsController(
      prisma as unknown as PrismaService,
      imports as unknown as ImportJobService,
    ),
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
      select: expect.objectContaining({
        id: true,
        startedAt: true,
        user: { select: { email: true } },
      }),
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

it("applies a date interval before pagination", async () => {
  const { controller, prisma } = makeController();
  await controller.listImportRuns(
    undefined,
    undefined,
    undefined,
    "1",
    "50",
    "2026-10-01T00:00:00Z",
    "2026-10-05T00:00:00Z",
  );
  expect(prisma.importRun.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        startedAt: {
          gte: new Date("2026-10-01T00:00:00Z"),
          lt: new Date("2026-10-05T00:00:00Z"),
        },
      }),
    }),
  );
});
it("returns ongoing imports and keeps them out of success and failure filters", async () => {
  const { controller, imports, prisma } = makeController();
  imports.listRunningImports.mockReturnValue([
    {
      ...run("active"),
      startedAt: "2026-10-04T10:00:00Z",
      finishedAt: null,
      status: "RUNNING",
    },
  ]);
  prisma.user.findMany.mockResolvedValue([
    { id: "user-1", email: "user@example.com" },
  ]);
  const result = await controller.listImportRuns(undefined, "RUNNING");
  expect(result.items).toEqual([
    expect.objectContaining({
      id: "active",
      identifier: "user@example.com",
      status: "RUNNING",
      finishedAt: null,
    }),
  ]);
  expect(prisma.importRun.findMany).not.toHaveBeenCalled();
  await controller.listImportRuns(undefined, "SUCCESS");
  expect(prisma.importRun.findMany).toHaveBeenCalledOnce();
});
it("accounts for active rows when paginating completed imports", async () => {
  const { controller, imports, prisma } = makeController();
  imports.listRunningImports.mockReturnValue([run("active")]);
  await controller.listImportRuns(undefined, undefined, undefined, "2", "2");
  expect(prisma.importRun.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ skip: 1, take: 3 }),
  );
});
it("returns stored details and distinguishes older runs without them", async () => {
  const { controller, prisma } = makeController();
  prisma.importRun.findUnique.mockResolvedValue({
    ...run("old"),
    details: null,
  });
  expect(await controller.importDetail("old")).toMatchObject({
    id: "old",
    details: null,
  });
  prisma.importRun.findUnique.mockResolvedValue({
    ...run("new"),
    details: { items: [{ title: "Example", state: "ignored" }], report: null },
  });
  expect(await controller.importDetail("new")).toMatchObject({
    details: { items: [{ title: "Example", state: "ignored" }] },
  });
});

it.each([
  ["invalid", undefined],
  ["2026-10-05", "2026-10-01"],
])("rejects invalid date ranges (%s, %s)", async (from, to) => {
  const { controller, prisma } = makeController();
  await expect(
    controller.listImportRuns(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      from,
      to,
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(prisma.importRun.findMany).not.toHaveBeenCalled();
});

it("does not expose details of an active import after its account disappears", async () => {
  const { controller, imports, prisma } = makeController();
  imports.listRunningImports.mockReturnValue([
    {
      ...run("active"),
      startedAt: "2026-10-04T10:00:00Z",
      finishedAt: null,
      status: "RUNNING",
    },
  ]);
  imports.runningImportDetails.mockReturnValue({
    items: [{ title: "Private movie", state: "selected" }],
    report: null,
  });
  prisma.user.findUnique.mockResolvedValue(null);
  expect(await controller.importDetail("active")).toMatchObject({
    details: null,
  });
});
