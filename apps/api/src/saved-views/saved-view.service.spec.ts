import { ErrorCode, SAVED_VIEW_LIMITS } from "@loomkeep/shared";
import { vi } from "vitest";
import type { EntitlementService } from "../entitlements/entitlement.service";
import type { PrismaService } from "../prisma/prisma.service";
import { SavedViewService } from "./saved-view.service";

interface Row {
  id: string;
  userId: string;
  name: string;
  domain: string;
  filters: object;
  createdAt: Date;
  updatedAt: Date;
}

/** An in-memory `savedView` table, holding `existing` views of "user-1". */
function makeService({ existing = 0, premium = false } = {}) {
  const rows: Row[] = Array.from({ length: existing }, (_, i) => ({
    id: `view-${i}`,
    userId: "user-1",
    name: `View ${i}`,
    domain: "GAMES",
    filters: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  const own = (where: { id?: string; userId: string }) =>
    rows.filter(
      (r) => r.userId === where.userId && (!where.id || r.id === where.id),
    );

  const prisma = {
    savedView: {
      count: vi.fn(({ where }) => Promise.resolve(own(where).length)),
      findFirst: vi.fn(({ where }) => Promise.resolve(own(where)[0] ?? null)),
      create: vi.fn(({ data }) => {
        const row = {
          ...data,
          id: `view-${rows.length}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(row);
        return Promise.resolve(row);
      }),
      update: vi.fn(({ where, data }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(
          row,
          Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined),
          ),
        );
        return Promise.resolve(row);
      }),
      delete: vi.fn(() => Promise.resolve()),
    },
  } as unknown as PrismaService;
  const entitlements = {
    isEffectivelyPremium: vi.fn().mockResolvedValue(premium),
  } as unknown as EntitlementService;

  return { service: new SavedViewService(prisma, entitlements), prisma };
}

describe("SavedViewService", () => {
  it("keeps only the statuses and types the view's library filters on", async () => {
    const { service } = makeService();

    const view = await service.create("user-1", {
      name: "  Backlog Switch  ",
      domain: "GAMES",
      filters: {
        statuses: ["BACKLOG", "WATCHING", "DORMANT"],
        types: ["MOVIE"],
        sort: "playtime",
      },
    });

    expect(view.name).toBe("Backlog Switch");
    expect(view.filters).toEqual({
      statuses: ["BACKLOG"],
      types: undefined,
      sort: "playtime",
    });
  });

  it("keeps media's derived DORMANT status and its types", async () => {
    const { service } = makeService();

    const view = await service.create("user-1", {
      name: "En pause",
      domain: "MEDIA",
      filters: { statuses: ["DORMANT"], types: ["SERIES"] },
    });

    expect(view.filters).toEqual({ statuses: ["DORMANT"], types: ["SERIES"] });
  });

  it("refuses a free account one view past its quota", async () => {
    const { service, prisma } = makeService({
      existing: SAVED_VIEW_LIMITS.free,
    });

    await expect(
      service.create("user-1", {
        name: "One more",
        domain: "BOOKS",
        filters: {},
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.LibrarySavedViewFreeQuotaExceeded,
    });
    expect(prisma.savedView.create).not.toHaveBeenCalled();
  });

  it("lets a premium account past the free quota, up to the hard cap", async () => {
    const past = makeService({
      existing: SAVED_VIEW_LIMITS.free,
      premium: true,
    });
    await expect(
      past.service.create("user-1", {
        name: "Fourth",
        domain: "BOOKS",
        filters: {},
      }),
    ).resolves.toMatchObject({ name: "Fourth" });

    const capped = makeService({
      existing: SAVED_VIEW_LIMITS.max,
      premium: true,
    });
    await expect(
      capped.service.create("user-1", {
        name: "Too many",
        domain: "BOOKS",
        filters: {},
      }),
    ).rejects.toMatchObject({ code: ErrorCode.LibrarySavedViewLimitReached });
  });

  it("checks updated filters against the view's own domain", async () => {
    const { service } = makeService({ existing: 1 });

    const view = await service.update("user-1", "view-0", {
      filters: { statuses: ["PLAYING", "READING"] },
    });

    expect(view.name).toBe("View 0");
    expect(view.filters.statuses).toEqual(["PLAYING"]);
  });

  it("404s someone else's view rather than touching it", async () => {
    const { service, prisma } = makeService({ existing: 1 });

    await expect(service.remove("user-2", "view-0")).rejects.toMatchObject({
      code: ErrorCode.LibrarySavedViewNotFound,
    });
    await expect(
      service.update("user-2", "view-0", { name: "Mine now" }),
    ).rejects.toMatchObject({ code: ErrorCode.LibrarySavedViewNotFound });
    expect(prisma.savedView.delete).not.toHaveBeenCalled();
    expect(prisma.savedView.update).not.toHaveBeenCalled();
  });
});
