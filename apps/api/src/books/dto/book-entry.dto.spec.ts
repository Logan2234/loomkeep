import { validate } from "class-validator";
import "reflect-metadata";
import { UpdateBookEntryDto } from "./update-book-entry.dto";
import { UpsertBookEntryDto } from "./upsert-book-entry.dto";

async function pageCountErrors(
  Dto: typeof UpsertBookEntryDto | typeof UpdateBookEntryDto,
  referencePageCount: number,
) {
  const errors = await validate(
    Object.assign(new Dto(), { referencePageCount }),
  );
  return errors.filter((error) => error.property === "referencePageCount");
}

describe("book entry page count", () => {
  it.each([UpsertBookEntryDto, UpdateBookEntryDto])(
    "%o accepts a long edition but not an implausible one",
    async (Dto) => {
      expect(await pageCountErrors(Dto, 5000)).toEqual([]);
      expect(await pageCountErrors(Dto, 5001)).toHaveLength(1);
    },
  );
});
