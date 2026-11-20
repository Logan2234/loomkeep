import { Logger } from "@nestjs/common";
import { vi, type Mock } from "vitest";
import type { AgeGateService } from "../users/age-gate.service";
import type { DomainGateService } from "../users/domain-gate.service";
import { CatalogController } from "./catalog.controller";
import type { MediaItemService } from "./media-item.service";

const user = { sub: "user-1" } as never;

describe("CatalogController.search", () => {
  function makeController(searchPage: Mock) {
    const ageGate = {
      allowsAdultContent: vi.fn().mockResolvedValue(true),
    } as unknown as AgeGateService;
    const domainGate = {
      assertEnabled: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainGateService;

    return new CatalogController({} as MediaItemService, ageGate, domainGate, {
      searchPage,
    } as never);
  }

  it("answers an empty page rather than failing when TMDB is down", async () => {
    const controller = makeController(
      vi.fn().mockRejectedValue(new Error("TMDB is down")),
    );

    const result = await controller.search(user, { q: "show" } as never);

    expect(result).toEqual({ items: [], hasMore: false });
  });

  it("logs a TMDB failure instead of passing it off as no results", async () => {
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => {});
    const controller = makeController(
      vi.fn().mockRejectedValue(new Error("TMDB is down")),
    );

    await controller.search(user, { q: "show" } as never);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("TMDB"),
      expect.any(Error),
    );
    warn.mockRestore();
  });

  it("keeps paging while TMDB has results the anime filter left out", async () => {
    const searchPage = vi.fn().mockResolvedValue({ items: [], hasMore: true });
    const controller = makeController(searchPage);

    const result = await controller.search(user, {
      q: "x",
      type: "ANIME",
      page: 2,
    } as never);

    expect(searchPage).toHaveBeenCalledWith("x", "ANIME", 2, undefined);
    expect(result.hasMore).toBe(true);
  });
});
