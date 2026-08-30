import { vi, type Mock } from "vitest";
import type { AgeGateService } from "../users/age-gate.service";
import type { DomainGateService } from "../users/domain-gate.service";
import { CatalogController } from "./catalog.controller";
import type { MediaItemService } from "./media-item.service";

const user = { sub: "user-1" } as never;

describe("CatalogController.search", () => {
  function makeController(opts: { tmdbSearch: Mock; anilistSearch: Mock }) {
    const mediaItemService = {
      providerFor: vi.fn((source: string) =>
        source === "TMDB"
          ? { search: opts.tmdbSearch }
          : { search: opts.anilistSearch },
      ),
    } as unknown as MediaItemService;
    const ageGate = {
      allowsAdultContent: vi.fn().mockResolvedValue(true),
    } as unknown as AgeGateService;
    const domainGate = {
      assertEnabled: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainGateService;

    return new CatalogController(mediaItemService, ageGate, domainGate);
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

  it("merges both sources' results when both succeed", async () => {
    const controller = makeController({
      tmdbSearch: vi.fn().mockResolvedValue([{ id: "t1", title: "Movie" }]),
      anilistSearch: vi.fn().mockResolvedValue([{ id: "a1", title: "Anime" }]),
    });

    const result = await controller.search(user, { q: "x" } as never);

    expect(result.items).toHaveLength(2);
  });
});
