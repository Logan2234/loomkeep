import type { MediaSagaDto, SagaMemberDto } from "@loomkeep/shared";
import { vi } from "vitest";
import type { AnilistProvider } from "../catalog/providers/anilist.provider";
import type { TmdbProvider } from "../catalog/providers/tmdb.provider";
import type { PrismaService } from "../prisma/prisma.service";
import type { AgeGateService } from "../users/age-gate.service";
import type { LibraryService } from "./library.service";
import { SagaService } from "./saga.service";

const member = (
  sourceId: string,
  extra: Partial<SagaMemberDto> = {},
): SagaMemberDto => ({
  source: "ANILIST",
  sourceId,
  type: "ANIME",
  title: `Work ${sourceId}`,
  year: 2020,
  posterUrl: null,
  isAdult: false,
  releaseDate: "2020-04-01",
  format: "TV",
  episodes: 12,
  upcoming: false,
  status: null,
  ...extra,
});

const franchise: MediaSagaDto = {
  key: "ANILIST:1",
  title: "Work 1",
  members: [member("1"), member("2"), member("3", { isAdult: true })],
};

function makeService(allowAdult = false) {
  const prisma = { mediaItem: { updateMany: vi.fn().mockResolvedValue({}) } };
  const anilist = { getSaga: vi.fn().mockResolvedValue(franchise) };
  const tmdb = { getSaga: vi.fn().mockResolvedValue(null) };
  const library = {
    statusesBySourceId: vi
      .fn()
      .mockResolvedValue(new Map([["1", "COMPLETED"]])),
  };
  const ageGate = {
    allowsAdultContent: vi.fn().mockResolvedValue(allowAdult),
  };
  const service = new SagaService(
    prisma as unknown as PrismaService,
    tmdb as unknown as TmdbProvider,
    anilist as unknown as AnilistProvider,
    library as unknown as LibraryService,
    ageGate as unknown as AgeGateService,
  );
  return { service, prisma, anilist, tmdb, library };
}

describe("SagaService", () => {
  it("adds the viewer's status to each work and tags the tracked ones with the saga", async () => {
    const { service, prisma, library } = makeService(true);

    const saga = await service.getSaga("user-1", "ANIME", "2");

    expect(saga?.members.map((m) => [m.sourceId, m.status])).toEqual([
      ["1", "COMPLETED"],
      ["2", null],
      ["3", null],
    ]);
    expect(library.statusesBySourceId).toHaveBeenCalledWith(
      "user-1",
      "ANILIST",
      "ANIME",
      ["1", "2", "3"],
    );
    expect(prisma.mediaItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { sagaKey: "ANILIST:1" } }),
    );
  });

  it("walks a franchise once for all of its works", async () => {
    const { service, anilist } = makeService();

    await service.getSaga("user-1", "ANIME", "2");
    await service.getSaga("user-2", "ANIME", "1");

    expect(anilist.getSaga).toHaveBeenCalledTimes(1);
  });

  it("leaves 18+ works out for an account that can't see them", async () => {
    const { service } = makeService(false);

    const saga = await service.getSaga("user-1", "ANIME", "1");

    expect(saga?.members.map((m) => m.sourceId)).toEqual(["1", "2"]);
  });

  it("has no saga to offer for a series", async () => {
    const { service, tmdb, anilist } = makeService();

    expect(await service.getSaga("user-1", "SERIES", "1399")).toBeNull();
    expect(tmdb.getSaga).not.toHaveBeenCalled();
    expect(anilist.getSaga).not.toHaveBeenCalled();
  });
});
