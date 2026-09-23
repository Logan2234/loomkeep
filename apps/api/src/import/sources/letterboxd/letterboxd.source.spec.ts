import { CatalogSource, MediaType } from "@loomkeep/shared";
import { vi, type Mock } from "vitest";
import type { MediaItemService } from "../../../catalog/media-item.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { ReviewService } from "../../../reviews/review.service";
import type { CommitDecisions } from "../../import-source";
import type { ImportList } from "../../media-import-model";
import type { MediaMatchResolver } from "../media/media-match-resolver";
import { isWanted, LetterboxdImportSource } from "./letterboxd.source";

const LIST: ImportList = {
  name: "Mon top noir",
  description: "Les meilleurs films noirs",
  ranked: true,
  items: [
    { title: "Chinatown", year: 1974, externalIds: {} },
    { title: "Heat", year: 1995, externalIds: {} },
  ],
};

function decisions(include: string[]): CommitDecisions {
  return {
    include: new Set(include),
    statuses: new Map(),
    overrides: new Map(),
    overwrite: false,
  };
}

/** Plan-resolved matches, keyed the way `movieKey` builds them. */
function matches(): Map<
  string,
  { source: CatalogSource; sourceId: string; type: MediaType }
> {
  return new Map([
    [
      "movie:chinatown:1974",
      {
        source: CatalogSource.TMDB,
        sourceId: "829",
        type: MediaType.MOVIE,
      },
    ],
    [
      "movie:heat:1995",
      { source: CatalogSource.TMDB, sourceId: "949", type: MediaType.MOVIE },
    ],
  ]);
}

function makeSource(existingList: { id: string } | null = null) {
  const prisma = {
    list: {
      findFirst: vi.fn().mockResolvedValue(existingList),
      create: vi.fn().mockResolvedValue({ id: "list-1" }),
    },
  } as unknown as PrismaService;

  const mediaItemService = {
    upsertFromSource: vi.fn((_source: string, sourceId: string) =>
      Promise.resolve({ id: `media-${sourceId}` }),
    ),
  } as unknown as MediaItemService;

  const source = new LetterboxdImportSource(
    prisma,
    mediaItemService,
    {} as unknown as MediaMatchResolver,
    {} as unknown as ReviewService,
  );

  const writeLists = (lists: ImportList[], included: string[]) =>
    (
      source as unknown as {
        writeLists: (
          userId: string,
          lists: ImportList[],
          decisions: CommitDecisions,
          matchByKey: ReturnType<typeof matches>,
          tally: { listsCreated: number },
        ) => Promise<void>;
      }
    ).writeLists("u1", lists, decisions(included), matches(), tally);

  const tally = { listsCreated: 0 };
  return { prisma, mediaItemService, writeLists, tally };
}

describe("LetterboxdImportSource — list writing", () => {
  const BOTH = ["movie:chinatown:1974", "movie:heat:1995"];

  it("creates the list with its films in export order", async () => {
    const { prisma, writeLists, tally } = makeSource();

    await writeLists([LIST], BOTH);

    expect(tally.listsCreated).toBe(1);
    const [[call]] = (prisma.list.create as Mock).mock.calls;
    expect(call.data).toMatchObject({
      userId: "u1",
      title: "Mon top noir",
      description: "Les meilleurs films noirs",
      kind: "RANKED",
    });
    expect(call.data.items.create).toEqual([
      { targetType: "MEDIA", targetId: "media-829", position: 0 },
      { targetType: "MEDIA", targetId: "media-949", position: 1 },
    ]);
  });

  it("marks an unranked list as a collection", async () => {
    const { prisma, writeLists } = makeSource();

    await writeLists([{ ...LIST, ranked: false }], BOTH);

    expect((prisma.list.create as Mock).mock.calls[0][0].data.kind).toBe(
      "COLLECTION",
    );
  });

  it("caches each film without adding it to the library", async () => {
    // Being on a list is not tracking: the media row is needed as the list
    // item's target, a LibraryEntry is not.
    const { mediaItemService, writeLists } = makeSource();

    await writeLists([LIST], BOTH);

    expect(mediaItemService.upsertFromSource).toHaveBeenCalledTimes(2);
  });

  it("leaves out a film the user excluded from the plan", async () => {
    const { prisma, writeLists } = makeSource();

    await writeLists([LIST], ["movie:heat:1995"]);

    expect(
      (prisma.list.create as Mock).mock.calls[0][0].data.items.create,
    ).toEqual([{ targetType: "MEDIA", targetId: "media-949", position: 0 }]);
  });

  it("skips a list whose title the user already has", async () => {
    // A re-run must not append the same films twice, and a list they have
    // since curated is theirs, not the importer's to edit.
    const { prisma, writeLists, tally } = makeSource({ id: "existing" });

    await writeLists([LIST], BOTH);

    expect(prisma.list.create).not.toHaveBeenCalled();
    expect(tally.listsCreated).toBe(0);
  });

  it("creates nothing for a list whose films were all excluded", async () => {
    const { prisma, writeLists } = makeSource();

    await writeLists([LIST], []);

    expect(prisma.list.create).not.toHaveBeenCalled();
  });

  it("does not repeat a film listed twice", async () => {
    const { prisma, writeLists } = makeSource();

    await writeLists(
      [{ ...LIST, items: [...LIST.items, LIST.items[0]] }],
      BOTH,
    );

    expect(
      (prisma.list.create as Mock).mock.calls[0][0].data.items.create,
    ).toHaveLength(2);
  });
});

describe("isWanted — which archive members are read", () => {
  it.each([
    "diary.csv",
    "ratings.csv",
    "watched.csv",
    "watchlist.csv",
    "reviews.csv",
    "profile.csv",
    "lists/mon-top.csv",
    "letterboxd-logan-2026-01-01/diary.csv",
    "letterboxd-logan-2026-01-01/lists/mon-top.csv",
  ])("reads %s", (path) => {
    expect(isWanted(path)).toBe(true);
  });

  it.each([
    // Re-importing these would resurrect entries the user deleted.
    "deleted/diary.csv",
    "deleted/reviews.csv",
    "orphaned/ratings.csv",
    // Other members' content, and a "like" is not a favourite.
    "likes/films.csv",
    "likes/lists.csv",
    "likes/reviews.csv",
    // No target in Loomkeep.
    "comments.csv",
  ])("skips %s", (path) => {
    expect(isWanted(path)).toBe(false);
  });

  it("does not mistake a deleted copy for the real diary", () => {
    // The reason the reader matches on the whole path: both files are called
    // diary.csv, and only one of them is current.
    expect(isWanted("letterboxd-logan/deleted/diary.csv")).toBe(false);
    expect(isWanted("letterboxd-logan/diary.csv")).toBe(true);
  });
});
