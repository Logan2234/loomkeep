import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { BookItemService } from "./book-item.service";
import { BookSagaService } from "./book-saga.service";
import type { ProviderBookSeries } from "./providers/book-provider.types";

const volume = (sourceId: string, position: number) => ({
  source: "OPEN_LIBRARY" as const,
  sourceId,
  title: `Tome ${position}`,
  authors: ["J.K. Rowling"],
  year: 1997 + position,
  coverUrl: null,
  isAdult: false,
  position,
});

const POTTER: ProviderBookSeries = {
  key: "OL326110L",
  title: "Harry Potter",
  members: [volume("OL1W", 1), volume("OL2W", 2), volume("OL3W", 3)],
};

type SavedSeries = {
  key: string;
  locale: string;
  series: unknown;
  fetchedAt: Date;
};

const DAY = 24 * 60 * 60 * 1000;

function makeService(
  statuses: Record<string, string>,
  saved: SavedSeries[] = [],
) {
  const getSeries = vi.fn().mockResolvedValue(POTTER);
  const rows = new Map(saved.map((row) => [`${row.key}:${row.locale}`, row]));
  const bookSeries = {
    findUnique: vi.fn(
      ({ where }: { where: { key_locale: { key: string; locale: string } } }) =>
        Promise.resolve(
          rows.get(`${where.key_locale.key}:${where.key_locale.locale}`) ??
            null,
        ),
    ),
    findMany: vi.fn(
      ({ where }: { where: { key: { in: string[] }; locale: string } }) =>
        Promise.resolve(
          where.key.in.flatMap((key) => {
            const row = rows.get(`${key}:${where.locale}`);
            return row ? [row] : [];
          }),
        ),
    ),
    upsert: vi.fn(({ create }: { create: SavedSeries }) => {
      rows.set(`${create.key}:${create.locale}`, create);
      return Promise.resolve(create);
    }),
  };
  const bookEntryFindMany = vi.fn((args: { select: object }) =>
    Promise.resolve(
      "status" in args.select
        ? Object.entries(statuses).map(([id, status]) => ({
            status,
            bookItem: { externalIds: [{ externalId: id }] },
          }))
        : [
            {
              updatedAt: new Date("2026-10-01T00:00:00Z"),
              finishedAt: new Date("2026-09-30T00:00:00Z"),
              bookItem: { seriesKey: "OL326110L" },
            },
          ],
    ),
  );
  const prisma = {
    bookEntry: { findMany: bookEntryFindMany },
    bookItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    bookSeries,
  };
  const service = new BookSagaService(
    prisma as unknown as PrismaService,
    { providerFor: () => ({ getSeries }) } as unknown as BookItemService,
  );
  return { service, prisma, getSeries };
}

describe("BookSagaService", () => {
  it("reads a series from Open Library once per language, then from the database", async () => {
    const { service, getSeries } = makeService({});

    await service.getSaga("u1", "OL326110L", "fr");
    await service.getSaga("u1", "OL326110L", "fr");
    await service.listSagas("u1", { lang: "fr" });

    expect(getSeries).toHaveBeenCalledOnce();
    expect(getSeries).toHaveBeenCalledWith("OL326110L", "fr");
  });

  // A restart used to empty the cache: the sagas view then waited on one
  // Open Library search per series.
  it("lists saved series without waiting on Open Library", async () => {
    const { service, getSeries } = makeService({ OL1W: "READ" }, [
      {
        key: "OL326110L",
        locale: "en",
        series: POTTER,
        fetchedAt: new Date(Date.now() - DAY),
      },
    ]);

    const sagas = await service.listSagas("u1");

    expect(sagas.inProgress.map((s) => s.key)).toEqual(["OL326110L"]);
    expect(getSeries).not.toHaveBeenCalled();
  });

  it("serves a series saved over a week ago, and reads it again behind", async () => {
    const stale = { ...POTTER, title: "Harry Potter (old)" };
    const { service, getSeries, prisma } = makeService({}, [
      {
        key: "OL326110L",
        locale: "en",
        series: stale,
        fetchedAt: new Date(Date.now() - 8 * DAY),
      },
    ]);

    const saga = await service.getSaga("u1", "OL326110L");

    expect(saga?.title).toBe("Harry Potter (old)");
    await vi.waitFor(() =>
      expect(prisma.bookSeries.upsert).toHaveBeenCalledOnce(),
    );
    expect(getSeries).toHaveBeenCalledWith("OL326110L", "en");
  });

  it("gives each volume the reader's status and ties the tracked ones to the series", async () => {
    const { service, prisma } = makeService({ OL1W: "READ" });

    const saga = await service.getSaga("u1", "OL326110L");

    expect(saga?.members.map((m) => [m.sourceId, m.status])).toEqual([
      ["OL1W", "READ"],
      ["OL2W", null],
      ["OL3W", null],
    ]);
    expect(prisma.bookItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ seriesKey: null }),
        data: { seriesKey: "OL326110L" },
      }),
    );
  });

  it("lists a started series with the next unread volume, a dropped one skipped", async () => {
    const { service } = makeService({ OL1W: "READ", OL2W: "DROPPED" });

    const sagas = await service.listSagas("u1");

    expect(sagas.inProgress).toEqual([
      expect.objectContaining({
        key: "OL326110L",
        next: expect.objectContaining({ sourceId: "OL3W" }),
        seen: 1,
        released: 3,
      }),
    ]);
    expect(sagas.finished).toEqual([]);
  });

  it("files a series read to the end, or dropped, as finished", async () => {
    const { service } = makeService({
      OL1W: "READ",
      OL2W: "READ",
      OL3W: "DROPPED",
    });

    const sagas = await service.listSagas("u1");

    expect(sagas.inProgress).toEqual([]);
    expect(sagas.finished).toEqual([
      expect.objectContaining({ key: "OL326110L", next: null, seen: 2 }),
    ]);
  });
});
