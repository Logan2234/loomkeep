import { Logger } from "@nestjs/common";
import { vi, type Mock } from "vitest";
import type { AgeGateService } from "../users/age-gate.service";
import { MediaCatalogController } from "./media-catalog.controller";
import type { MediaItemService } from "./media-item.service";

const user = { sub: "user-1" } as never;

describe("MediaCatalogController.search", () => {
  function makeController(opts: {
    tmdbSearch: Mock;
    anilistSearch: Mock;
    allowAdult?: boolean;
  }) {
    const mediaItemService = {
      providerFor: vi.fn((source: string) =>
        source === "TMDB"
          ? { search: opts.tmdbSearch }
          : { search: opts.anilistSearch },
      ),
    } as unknown as MediaItemService;
    const ageGate = {
      allowsAdultContent: vi.fn().mockResolvedValue(opts.allowAdult ?? true),
    } as unknown as AgeGateService;

    return new MediaCatalogController(mediaItemService, ageGate, {} as never);
  }

  it("degrades to the other source's results when one provider rejects", async () => {
    const anilistResults = [{ id: "a1", title: "Anilist Show" }];
    const controller = makeController({
      tmdbSearch: vi.fn().mockRejectedValue(new Error("TMDB is down")),
      anilistSearch: vi.fn().mockResolvedValue(anilistResults),
    });

    const result = await controller.search(user, { q: "show" } as never);

    expect(result.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "a1" })]),
    );
  });

  it("logs a provider failure instead of passing it off as no results", async () => {
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => {});
    const controller = makeController({
      tmdbSearch: vi.fn().mockRejectedValue(new Error("TMDB is down")),
      anilistSearch: vi.fn().mockResolvedValue([]),
    });

    await controller.search(user, { q: "show" } as never);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("TMDB"),
      expect.any(Error),
    );
    warn.mockRestore();
  });

  it("keeps paging when the 18+ filter empties a page the providers filled", async () => {
    const controller = makeController({
      tmdbSearch: vi
        .fn()
        .mockResolvedValue([{ id: "t1", title: "Show", isAdult: true }]),
      anilistSearch: vi.fn().mockResolvedValue([]),
      allowAdult: false,
    });

    const result = await controller.search(user, { q: "show" } as never);

    expect(result).toEqual({ items: [], hasMore: true });
  });

  it("merges both sources' results when both succeed", async () => {
    const controller = makeController({
      tmdbSearch: vi.fn().mockResolvedValue([{ id: "t1", title: "Movie" }]),
      anilistSearch: vi.fn().mockResolvedValue([{ id: "a1", title: "Anime" }]),
    });

    const result = await controller.search(user, { q: "x" } as never);

    expect(result.items).toHaveLength(2);
  });
});
