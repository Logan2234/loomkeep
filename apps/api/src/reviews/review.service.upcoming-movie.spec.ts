import { vi } from "vitest";
import { ReviewService } from "./review.service";

describe("unreleased movie reviews", () => {
  const make = () => {
    const upsert = vi.fn();
    const deleteMany = vi.fn();
    const prisma = {
      mediaItem: {
        findUnique: vi.fn().mockResolvedValue({
          type: "MOVIE",
          status: "Post Production",
          movieReleaseDates: [{ country: "US", date: "2099-12-18", type: 3 }],
        }),
      },
      review: {
        upsert,
        findUnique: vi.fn().mockResolvedValue(null),
        deleteMany,
      },
    };
    const service = new ReviewService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, upsert, deleteMany };
  };

  it("rejects a direct review before creating a review or activity", async () => {
    const { service, upsert } = make();
    await expect(
      service.upsert("u1", "MEDIA", "m1", { rating: 8, text: "My review" }),
    ).rejects.toMatchObject({ code: "library.movie_not_released" });
    expect(upsert).not.toHaveBeenCalled();
  });
  it("also rejects the quick-rating path", async () => {
    const { service, upsert } = make();
    await expect(
      service.setRating("u1", "MEDIA", "m1", 8),
    ).rejects.toMatchObject({ code: "library.movie_not_released" });
    expect(upsert).not.toHaveBeenCalled();
  });
  it("still allows removing an old rating", async () => {
    const { service, deleteMany } = make();
    await service.setRating("u1", "MEDIA", "m1", null);
    expect(deleteMany).toHaveBeenCalled();
  });
});
