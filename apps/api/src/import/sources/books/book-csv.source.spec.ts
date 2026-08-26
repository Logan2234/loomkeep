import type {
  BookSummaryDto,
  ImportPlan,
  ImportPlanItem,
} from "@loomkeep/shared";
import type { BookItemService } from "../../../books/book-item.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { AgeGateService } from "../../../users/age-gate.service";
import { ImportJobService } from "../../import-job.service";
import { StoryGraphImportSource } from "./storygraph.source";

const HEADER =
  "Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?";

function summary(over: Partial<BookSummaryDto> = {}): BookSummaryDto {
  return {
    source: "OPEN_LIBRARY",
    sourceId: "G1W",
    title: "A Book",
    authors: ["Someone"],
    year: 2000,
    coverUrl: null,
    isAdult: false,
    ...over,
  };
}

function setup(
  overrides: {
    resolve?: jest.Mock;
    resolveByIsbns?: jest.Mock;
    getDetails?: jest.Mock;
    inLibraryRefs?: {
      source: string;
      externalId: string;
      bookItemId: string;
    }[];
    ownedEntries?: { bookItemId: string }[];
    existingEntry?: { id: string } | null;
    allowAdult?: boolean;
  } = {},
) {
  const getDetails = overrides.getDetails ?? jest.fn();
  const bookItemService = {
    resolve: overrides.resolve ?? jest.fn().mockResolvedValue(null),
    resolveByIsbns:
      overrides.resolveByIsbns ??
      jest.fn().mockResolvedValue({ matches: new Map(), failedIsbns: [] }),
    providerFor: jest.fn().mockReturnValue({ getDetails }),
    persistDetails: jest.fn().mockResolvedValue({ id: "item-1" }),
  };
  const upsert = jest.fn().mockResolvedValue({ id: "entry-1" });
  const createMany = jest.fn().mockResolvedValue({ count: 0 });
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    bookExternalId: {
      findMany: jest.fn().mockResolvedValue(overrides.inLibraryRefs ?? []),
    },
    bookEntry: {
      findMany: jest.fn().mockResolvedValue(overrides.ownedEntries ?? []),
      findUnique: jest.fn().mockResolvedValue(overrides.existingEntry ?? null),
      upsert,
      deleteMany,
    },
    bookReplay: { createMany },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: "test@example.com" }),
    },
    importRun: { create: jest.fn() },
  };
  const ageGate = {
    allowsAdultContent: jest
      .fn()
      .mockResolvedValue(overrides.allowAdult ?? true),
  };

  const reviews = { setRating: jest.fn().mockResolvedValue(undefined) };
  const source = new StoryGraphImportSource(
    prisma as unknown as PrismaService,
    bookItemService as unknown as BookItemService,
    ageGate as unknown as AgeGateService,
    reviews as unknown as import("../../../reviews/review.service").ReviewService,
  );
  const service = new ImportJobService(
    [source],
    prisma as unknown as PrismaService,
    {} as never,
    { isEffectivelyPremium: jest.fn().mockResolvedValue(true) } as never,
  );
  return { service, bookItemService, upsert, createMany, deleteMany, reviews };
}

async function runToEnd(
  service: ImportJobService,
  userId: string,
  jobId: string,
) {
  for (let i = 0; i < 100; i++) {
    if (service.getJob(userId, jobId).status !== "running") break;
    await new Promise((resolve) => setImmediate(resolve));
  }

  return service.getJob(userId, jobId);
}

function items(plan: ImportPlan): ImportPlanItem[] {
  return plan.groups.flatMap((g) => g.items);
}

function byKey(plan: ImportPlan, key: string): ImportPlanItem | undefined {
  return items(plan).find((it) => it.key === key);
}

async function analyze(service: ImportJobService, csv: string) {
  const { id } = await service.startAnalyze("user-1", "storygraph", {
    input: csv,
  });
  return runToEnd(service, "user-1", id);
}

describe("BookCsvSource (via StoryGraphImportSource)", () => {
  it("resolves rows, groups by status and reports the unmatched", async () => {
    const resolveByIsbns = jest.fn().mockResolvedValue({
      matches: new Map([
        ["9782228937597", summary({ sourceId: "OL1W", title: "First" })],
      ]),
      failedIsbns: [],
    });
    const resolve = jest
      .fn()
      .mockResolvedValueOnce(summary({ sourceId: "G-2", title: "Second" }))
      .mockResolvedValueOnce(null); // Unmatched.
    const { service } = setup({ resolve, resolveByIsbns });

    const csv = [
      HEADER,
      'Résister,Salomé Saqué,"",9782228937597,paperback,read,2025/07/23,2025/03/31,2025/02/01-2025/03/31,1,"",fast,,,,,,4.0,"","","","",Yes',
      'Findable,Author One,"",,digital,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
      'Nowhere,Author Two,"",,digital,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
    ].join("\n");
    const job = await analyze(service, csv);

    expect(job.status).toBe("completed");
    expect(job.plan!.counts).toEqual({
      total: 3,
      matched: 2,
      unresolved: 1,
      apiErrors: 0,
    });
    // Grouped by the CSV's own status.
    expect(job.plan!.groups.map((g) => g.id).sort()).toEqual([
      "READ",
      "TO_READ",
    ]);
    expect(byKey(job.plan!, "b0")).toMatchObject({
      sourceTitle: "Résister",
      subtitle: "★ 8/10",
      defaultStatus: "READ",
      include: true,
      match: { source: "OPEN_LIBRARY", sourceId: "OL1W" },
    });
    expect(byKey(job.plan!, "b2")).toMatchObject({
      sourceTitle: "Nowhere",
      match: null,
      include: false,
    });
  });

  it("counts API failures separately from genuine non-matches", async () => {
    const resolve = jest
      .fn()
      .mockResolvedValueOnce(summary({ sourceId: "OL1W" }))
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce(null);
    const { service } = setup({ resolve });

    const csv = [
      HEADER,
      'First,X,"",,digital,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
      'Second,X,"",,digital,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
      'Third,X,"",,digital,to-read,2025/01/01,"","",0,"",,,,,,,,"","","","",Yes',
    ].join("\n");
    const job = await analyze(service, csv);

    expect(job.plan!.counts).toMatchObject({
      matched: 1,
      unresolved: 2,
      apiErrors: 1,
    });
  });

  it("flags books already in the user's library by (source, id)", async () => {
    const { service } = setup({
      resolveByIsbns: jest.fn().mockResolvedValue({
        matches: new Map([["9782228937597", summary({ sourceId: "OL-DUPW" })]]),
        failedIsbns: [],
      }),
      inLibraryRefs: [
        {
          source: "OPEN_LIBRARY",
          externalId: "OL-DUPW",
          bookItemId: "item-dup",
        },
      ],
      ownedEntries: [{ bookItemId: "item-dup" }],
    });

    const csv = [
      HEADER,
      'Dup,Author,"",9782228937597,paperback,read,2025/07/23,"","",0,"",,,,,,,,"","","","",Yes',
    ].join("\n");
    const job = await analyze(service, csv);

    const item = byKey(job.plan!, "b0")!;
    expect(item.alreadyInLibrary).toBe(true);
    expect(item.include).toBe(false); // already tracked → unchecked by default
  });

  it("skips adult titles in the plan when the account is not opted in", async () => {
    const { service } = setup({
      allowAdult: false,
      resolveByIsbns: jest.fn().mockResolvedValue({
        matches: new Map([
          ["9782228937597", summary({ sourceId: "G-ADULT", isAdult: true })],
        ]),
        failedIsbns: [],
      }),
    });

    const csv = [
      HEADER,
      'Adult,Author,"",9782228937597,paperback,read,2025/07/23,"","",0,"",,,,,,,,"","","","",Yes',
    ].join("\n");
    const job = await analyze(service, csv);

    expect(items(job.plan!)).toHaveLength(0);
    expect(job.plan!.counts.matched).toBe(0);
  });

  it("commit persists metadata, marks finished books fully read, backfills replays", async () => {
    const getDetails = jest.fn().mockResolvedValue({
      summary: summary({ sourceId: "OL1W" }),
      overview: null,
      genres: [],
      pageCount: 320,
      releaseDate: null,
      externalIds: [{ source: "OPEN_LIBRARY", externalId: "OL1W" }],
    });
    const { service, bookItemService, upsert, createMany, reviews } = setup({
      getDetails,
      resolveByIsbns: jest.fn().mockResolvedValue({
        matches: new Map([["9782228937597", summary({ sourceId: "OL1W" })]]),
        failedIsbns: [],
      }),
    });

    const csv = [
      HEADER,
      'Résister,Salomé Saqué,"",9782228937597,paperback,read,2025/07/23,2025/03/31,2025/02/01-2025/03/31,3,"",fast,,,,,,4.0,loved it,"","","",Yes',
    ].join("\n");
    const analyzed = await service.startAnalyze("user-1", "storygraph", {
      input: csv,
    });
    await runToEnd(service, "user-1", analyzed.id);

    const committed = service.commit("user-1", "storygraph", analyzed.id, {
      include: ["b0"],
    });
    const job = await runToEnd(service, "user-1", committed.id);

    expect(job.status).toBe("completed");
    expect(bookItemService.providerFor).toHaveBeenCalled();
    const data = upsert.mock.calls[0][0].create;
    expect(data).toMatchObject({
      status: "READ",
      notes: "loved it",
      currentPage: 320,
      ownershipStatus: "PHYSICAL",
    });
    expect(data.finishedAt).toEqual(new Date("2025-03-31T00:00:00.000Z"));
    // The rating now lands in Review (source of truth), not on the entry.
    expect(reviews.setRating).toHaveBeenCalledWith(
      "user-1",
      "BOOK",
      expect.any(String),
      8,
    );
    // Read Count 3 → 2 backfilled replays on a first-time import.
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          bookEntryId: "entry-1",
          finishedAt: new Date("2025-03-31T00:00:00.000Z"),
        },
        {
          bookEntryId: "entry-1",
          finishedAt: new Date("2025-03-31T00:00:00.000Z"),
        },
      ],
    });
  });

  it("commit does not backfill replays when the entry already exists", async () => {
    const getDetails = jest.fn().mockResolvedValue({
      summary: summary({ sourceId: "OL1W" }),
      overview: null,
      genres: [],
      pageCount: 320,
      releaseDate: null,
      externalIds: [{ source: "OPEN_LIBRARY", externalId: "OL1W" }],
    });
    const { service, createMany } = setup({
      getDetails,
      existingEntry: { id: "entry-1" },
      resolveByIsbns: jest.fn().mockResolvedValue({
        matches: new Map([["9782228937597", summary({ sourceId: "OL1W" })]]),
        failedIsbns: [],
      }),
    });

    const csv = [
      HEADER,
      'Résister,Salomé Saqué,"",9782228937597,paperback,read,2025/07/23,2025/03/31,"",3,"",,,,,,,,"","","","",Yes',
    ].join("\n");
    const analyzed = await service.startAnalyze("user-1", "storygraph", {
      input: csv,
    });
    await runToEnd(service, "user-1", analyzed.id);
    const committed = service.commit("user-1", "storygraph", analyzed.id, {
      include: ["b0"],
    });
    await runToEnd(service, "user-1", committed.id);

    expect(createMany).not.toHaveBeenCalled();
  });

  it("commit skips adult titles even if their key is included", async () => {
    const getDetails = jest.fn().mockResolvedValue({
      summary: summary({ sourceId: "OL1W", isAdult: true }),
      overview: null,
      genres: [],
      pageCount: 320,
      releaseDate: null,
      externalIds: [{ source: "OPEN_LIBRARY", externalId: "OL1W" }],
    });
    // The plan resolves it (opted-in during analyze), but commit re-checks with
    // adult disabled → skipped.
    const { service, upsert } = setup({
      getDetails,
      allowAdult: false,
      resolveByIsbns: jest.fn().mockResolvedValue({
        matches: new Map([["9782228937597", summary({ sourceId: "OL1W" })]]),
        failedIsbns: [],
      }),
    });

    const csv = [
      HEADER,
      'X,Author,"",9782228937597,paperback,read,2025/07/23,"","",0,"",,,,,,,,"","","","",Yes',
    ].join("\n");
    const analyzed = await service.startAnalyze("user-1", "storygraph", {
      input: csv,
    });
    const plan = await runToEnd(service, "user-1", analyzed.id);
    // Adult filtered from plan while opted-out — nothing to include; force the id.
    const key = items(plan.plan!)[0]?.key ?? "b0";
    const committed = service.commit("user-1", "storygraph", analyzed.id, {
      include: [key],
    });
    await runToEnd(service, "user-1", committed.id);

    expect(upsert).not.toHaveBeenCalled();
  });

  it("commit with overwrite wipes the book library first", async () => {
    const getDetails = jest.fn().mockResolvedValue({
      summary: summary({ sourceId: "OL1W" }),
      overview: null,
      genres: [],
      pageCount: 100,
      releaseDate: null,
      externalIds: [{ source: "OPEN_LIBRARY", externalId: "OL1W" }],
    });
    const { service, deleteMany } = setup({
      getDetails,
      resolveByIsbns: jest.fn().mockResolvedValue({
        matches: new Map([["9782228937597", summary({ sourceId: "OL1W" })]]),
        failedIsbns: [],
      }),
    });

    const csv = [
      HEADER,
      'X,Author,"",9782228937597,paperback,read,2025/07/23,"","",0,"",,,,,,,,"","","","",Yes',
    ].join("\n");
    const analyzed = await service.startAnalyze("user-1", "storygraph", {
      input: csv,
    });
    await runToEnd(service, "user-1", analyzed.id);
    const committed = service.commit("user-1", "storygraph", analyzed.id, {
      include: ["b0"],
      overwrite: true,
    });
    const job = await runToEnd(service, "user-1", committed.id);

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(job.report!.overwrite).toBe(true);
  });
});
