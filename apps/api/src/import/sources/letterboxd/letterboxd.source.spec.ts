import { CatalogSource, MediaType } from "@loomkeep/shared";
import { vi } from "vitest";
import type { MediaItemService } from "../../../catalog/media-item.service";
import type { ListService } from "../../../lists/list.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { ReviewService } from "../../../reviews/review.service";
import type { CommitDecisions } from "../../import-source";
import type { ImportList } from "../../media-import-model";
import type { MediaMatchResolver } from "../media/media-match-resolver";
import { isWanted, LetterboxdImportSource } from "./letterboxd.source";

const LIST: ImportList = {
  name: "Mon top noir",
  description: "Les meilleurs films noirs",
  items: [
    { title: "Chinatown", year: 1974, externalIds: {}, note: "Le scénario" },
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
    list: { findFirst: vi.fn().mockResolvedValue(existingList) },
  } as unknown as PrismaService;

  const mediaItemService = {
    upsertFromSource: vi.fn((_source: string, sourceId: string) =>
      Promise.resolve({ id: `media-${sourceId}` }),
    ),
  } as unknown as MediaItemService;

  const lists = {
    create: vi.fn().mockResolvedValue({ id: "list-1" }),
    addImportedItems: vi.fn().mockResolvedValue(undefined),
  };

  const source = new LetterboxdImportSource(
    prisma,
    mediaItemService,
    {} as unknown as MediaMatchResolver,
    {} as unknown as ReviewService,
    lists as unknown as ListService,
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
  const itemsAdded = () => lists.addImportedItems.mock.calls[0]?.[2];
  return { lists, mediaItemService, writeLists, tally, itemsAdded };
}

describe("LetterboxdImportSource — list writing", () => {
  const BOTH = ["movie:chinatown:1974", "movie:heat:1995"];

  it("creates the list like the user would, its films in export order", async () => {
    // Through ListService: the user's default visibility, the Figurant
    // clamp, the activity and XP of a list they make themselves.
    const { lists, writeLists, tally, itemsAdded } = makeSource();

    await writeLists([LIST], BOTH);

    expect(tally.listsCreated).toBe(1);
    expect(lists.create).toHaveBeenCalledWith("u1", {
      title: "Mon top noir",
      description: "Les meilleurs films noirs",
      kind: "COLLECTION",
    });
    expect(lists.addImportedItems).toHaveBeenCalledWith(
      "u1",
      "list-1",
      expect.any(Array),
    );
    expect(itemsAdded()).toEqual([
      { targetType: "MEDIA", targetId: "media-829", note: "Le scénario" },
      { targetType: "MEDIA", targetId: "media-949", note: null },
    ]);
  });

  it("caches each film without adding it to the library", async () => {
    // Being on a list is not tracking: the media row is needed as the list
    // item's target, a LibraryEntry is not.
    const { mediaItemService, writeLists } = makeSource();

    await writeLists([LIST], BOTH);

    expect(mediaItemService.upsertFromSource).toHaveBeenCalledTimes(2);
  });

  it("leaves out a film the user excluded from the plan", async () => {
    const { writeLists, itemsAdded } = makeSource();

    await writeLists([LIST], ["movie:heat:1995"]);

    expect(itemsAdded()).toEqual([
      { targetType: "MEDIA", targetId: "media-949", note: null },
    ]);
  });

  it("skips a list whose title the user already has", async () => {
    // A re-run must not append the same films twice, and a list they have
    // since curated is theirs, not the importer's to edit.
    const { lists, writeLists, tally } = makeSource({ id: "existing" });

    await writeLists([LIST], BOTH);

    expect(lists.create).not.toHaveBeenCalled();
    expect(tally.listsCreated).toBe(0);
  });

  it("creates nothing for a list whose films were all excluded", async () => {
    const { lists, writeLists } = makeSource();

    await writeLists([LIST], []);

    expect(lists.create).not.toHaveBeenCalled();
  });

  it("does not repeat a film listed twice", async () => {
    const { writeLists, itemsAdded } = makeSource();

    await writeLists(
      [{ ...LIST, items: [...LIST.items, LIST.items[0]] }],
      BOTH,
    );

    expect(itemsAdded()).toHaveLength(2);
  });

  it("fits a long name and description into a list's limits", async () => {
    const { lists, writeLists } = makeSource();

    await writeLists(
      [{ ...LIST, name: "N".repeat(150), description: "D".repeat(600) }],
      BOTH,
    );

    const [, dto] = lists.create.mock.calls[0];
    expect(dto.title).toHaveLength(100);
    expect(dto.description).toHaveLength(500);
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
