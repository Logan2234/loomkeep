import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import "reflect-metadata";
import { UpsertReviewBody } from "./upsert-review.dto";

async function errorsFor(rating: number) {
  const errors = await validate(plainToInstance(UpsertReviewBody, { rating }));
  return errors.filter((e) => e.property === "rating");
}

describe("UpsertReviewBody rating", () => {
  it.each([0, 7.5, 10])(
    "accepts %s, on the half-point grid",
    async (rating) => {
      expect(await errorsFor(rating)).toHaveLength(0);
    },
  );

  it.each([7.3, 10.5, -0.5])("refuses %s", async (rating) => {
    expect(await errorsFor(rating)).not.toHaveLength(0);
  });
});
