import { ErrorCode, MediaType } from "@loomkeep/shared";
import { vi } from "vitest";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import type { DomainGateService } from "../users/domain-gate.service";
import type { CreatorService } from "./creator.service";
import { CreatorsController } from "./creators.controller";

const user = { sub: "u1" } as JwtPayload;

function setup() {
  const creators = {
    getPerson: vi.fn().mockResolvedValue({}),
    getStudio: vi.fn().mockResolvedValue({}),
    getStudioWorks: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
  };
  const domainGate = { assertEnabled: vi.fn().mockResolvedValue(undefined) };
  const controller = new CreatorsController(
    creators as unknown as CreatorService,
    domainGate as unknown as DomainGateService,
  );
  return { controller, creators, domainGate };
}

describe("CreatorsController", () => {
  it("gates an author's page on Books and a TMDB person's on Media", async () => {
    const { controller, domainGate } = setup();

    await controller.getPerson(user, "openlibrary", "OL25712A");
    await controller.getPerson(user, "TMDB", "137427");

    expect(domainGate.assertEnabled.mock.calls.map(([, d]) => d)).toEqual([
      "BOOKS",
      "MEDIA",
    ]);
  });

  it("reads a network's works page with its type, order and page", async () => {
    const { controller, creators } = setup();

    await controller.getNetworkWorks(
      user,
      "tmdb",
      "49",
      "series",
      "newest",
      "3",
      "fr",
    );
    await controller.getCompanyWorks(user, "tmdb", "41077", "MOVIE");

    expect(creators.getStudioWorks).toHaveBeenNthCalledWith(
      1,
      "u1",
      "tmdb",
      "NETWORK",
      "49",
      { type: MediaType.SERIES, order: "newest", page: 3 },
      "fr",
    );
    expect(creators.getStudioWorks.mock.calls[1][4]).toEqual({
      type: MediaType.MOVIE,
      order: "known",
      page: 1,
    });
  });

  it("refuses an anime type or an unknown order", async () => {
    const { controller, creators } = setup();

    await expect(
      controller.getCompanyWorks(user, "tmdb", "41077", "ANIME"),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParam });
    await expect(
      controller.getCompanyWorks(user, "tmdb", "41077", "MOVIE", "popular"),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParam });
    expect(creators.getStudioWorks).not.toHaveBeenCalled();
  });
});
