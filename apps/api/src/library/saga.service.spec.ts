import type { MediaSagaDto, SagaMemberDto } from "@loomkeep/shared";
import { vi } from "vitest";
import type { SagaSyncService } from "../catalog/saga-sync.service";
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
  const sagas = {
    read: vi.fn().mockResolvedValue(franchise),
    rememberMembership: vi.fn().mockResolvedValue(0),
    sync: vi.fn().mockResolvedValue(undefined),
    readCollection: vi.fn().mockResolvedValue(null),
  };
  const library = {
    statusesBySourceId: vi
      .fn()
      .mockResolvedValue(new Map([["1", "COMPLETED"]])),
  };
  const ageGate = {
    allowsAdultContent: vi.fn().mockResolvedValue(allowAdult),
  };
  const prisma = {
    libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
    saga: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const service = new SagaService(
    prisma as unknown as PrismaService,
    sagas as unknown as SagaSyncService,
    library as unknown as LibraryService,
    ageGate as unknown as AgeGateService,
  );
  return { service, sagas, library, prisma };
}

describe("SagaService", () => {
  it("adds the viewer's status to each work and tags the tracked ones with the saga", async () => {
    const { service, sagas, library } = makeService(true);

    const saga = await service.getSaga("user-1", "ANIME", "2", "fr");

    expect(saga?.members.map((m) => [m.sourceId, m.status])).toEqual([
      ["1", "COMPLETED"],
      ["2", null],
      ["3", null],
    ]);
    expect(sagas.read).toHaveBeenCalledWith("ANIME", "2", "fr");
    expect(library.statusesBySourceId).toHaveBeenCalledWith(
      "user-1",
      "ANILIST",
      "ANIME",
      ["1", "2", "3"],
    );
    expect(sagas.rememberMembership).toHaveBeenCalledWith(
      "ANIME",
      ["1", "2", "3"],
      "ANILIST:1",
    );
  });

  it("saves the saga at once when a work of it was just tracked", async () => {
    const { service, sagas } = makeService(true);
    sagas.rememberMembership.mockResolvedValue(1);

    await service.getSaga("user-1", "ANIME", "2");

    expect(sagas.sync).toHaveBeenCalledWith("ANIME", "2");
  });

  it("leaves 18+ works out for an account that can't see them", async () => {
    const { service } = makeService(false);

    const saga = await service.getSaga("user-1", "ANIME", "1");

    expect(saga?.members.map((m) => m.sourceId)).toEqual(["1", "2"]);
  });

  it("has no saga to offer for a series", async () => {
    const { service, sagas } = makeService();

    expect(await service.getSaga("user-1", "SERIES", "1399")).toBeNull();
    expect(sagas.read).not.toHaveBeenCalled();
  });

  it("lists the library's sagas in progress and waiting, most recently touched first", async () => {
    const { service, prisma, library } = makeService(true);
    const row = (sagaKey: string, sourceId: string, upcoming = false) => ({
      sagaKey,
      source: "TMDB",
      sourceId,
      type: "MOVIE",
      position: Number(sourceId),
      title: `Film ${sourceId}`,
      posterUrl: null,
      releaseDate: upcoming ? null : "2020-01-01",
      format: null,
      episodes: null,
      isAdult: false,
      upcoming,
    });
    prisma.libraryEntry.findMany.mockResolvedValue([
      { updatedAt: new Date("2026-09-01"), mediaItem: { sagaKey: "TMDB:1" } },
      { updatedAt: new Date("2026-10-01"), mediaItem: { sagaKey: "TMDB:2" } },
      { updatedAt: new Date("2026-08-01"), mediaItem: { sagaKey: "TMDB:3" } },
      {
        updatedAt: new Date("2026-07-20"),
        finishedAt: new Date("2026-07-15"),
        mediaItem: { sagaKey: "TMDB:4" },
      },
    ]);
    prisma.saga.findMany.mockResolvedValue([
      {
        key: "TMDB:1",
        title: "Alpha",
        members: [row("TMDB:1", "11"), row("TMDB:1", "12")],
      },
      {
        key: "TMDB:2",
        title: "Beta",
        members: [row("TMDB:2", "21"), row("TMDB:2", "22")],
      },
      {
        key: "TMDB:3",
        title: "Gamma",
        members: [row("TMDB:3", "31"), row("TMDB:3", "32", true)],
      },
      {
        key: "TMDB:4",
        title: "Delta",
        members: [row("TMDB:4", "41"), row("TMDB:4", "42")],
      },
    ]);
    library.statusesBySourceId.mockResolvedValue(
      new Map([
        ["11", "COMPLETED"],
        ["21", "COMPLETED"],
        ["31", "COMPLETED"],
        ["41", "COMPLETED"],
        ["42", "DROPPED"],
      ]),
    );

    const sagas = await service.listSagas("user-1");

    expect(sagas.inProgress.map((s) => [s.title, s.next?.sourceId])).toEqual([
      ["Beta", "22"],
      ["Alpha", "12"],
    ]);
    expect(sagas.waiting.map((s) => [s.title, s.next?.sourceId])).toEqual([
      ["Gamma", "32"],
    ]);
    expect(sagas.finished.map((s) => [s.title, s.finishedAt])).toEqual([
      ["Delta", "2026-07-15T00:00:00.000Z"],
    ]);
  });

  it("shows film sagas in the viewer's language, keeping the saved titles when that fails", async () => {
    const { service, prisma, library, sagas } = makeService(true);
    const row = (sagaKey: string, sourceId: string, type = "MOVIE") => ({
      sagaKey,
      source: type === "ANIME" ? "ANILIST" : "TMDB",
      sourceId,
      type,
      position: 0,
      title: `Saved ${sourceId}`,
      posterUrl: null,
      releaseDate: "2020-01-01",
      format: null,
      episodes: null,
      isAdult: false,
      upcoming: false,
    });
    prisma.libraryEntry.findMany.mockResolvedValue([
      {
        updatedAt: new Date("2026-10-01"),
        mediaItem: { sagaKey: "TMDB:726871" },
      },
      {
        updatedAt: new Date("2026-09-01"),
        mediaItem: { sagaKey: "ANILIST:1" },
      },
    ]);
    prisma.saga.findMany.mockResolvedValue([
      {
        key: "TMDB:726871",
        title: "Dune Collection",
        members: [row("TMDB:726871", "1"), row("TMDB:726871", "2")],
      },
      {
        key: "ANILIST:1",
        title: "Attack on Titan",
        members: [
          row("ANILIST:1", "10", "ANIME"),
          row("ANILIST:1", "11", "ANIME"),
        ],
      },
    ]);
    library.statusesBySourceId.mockResolvedValue(
      new Map([
        ["1", "COMPLETED"],
        ["10", "COMPLETED"],
      ]),
    );
    sagas.readCollection.mockResolvedValue({
      key: "TMDB:726871",
      title: "Dune - Saga",
      members: [
        member("1", { title: "Dune" }),
        member("2", { title: "Dune : Deuxième partie" }),
      ],
    });

    const result = await service.listSagas("user-1", { lang: "fr" });

    expect(result.inProgress.map((s) => [s.title, s.next?.title])).toEqual([
      ["Dune - Saga", "Dune : Deuxième partie"],
      ["Attack on Titan", "Saved 11"],
    ]);
    expect(sagas.readCollection).toHaveBeenCalledOnce();
    expect(sagas.readCollection).toHaveBeenCalledWith(
      "TMDB:726871",
      ["1", "2"],
      "fr",
    );
  });
});
