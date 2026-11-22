import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import "reflect-metadata";
import { UpdateGameEntryDto } from "./update-game-entry.dto";

async function errorsFor(playtimeMinutes: number) {
  return validate(plainToInstance(UpdateGameEntryDto, { playtimeMinutes }));
}

describe("UpdateGameEntryDto playtimeMinutes", () => {
  it("refuses a playtime past what the column can hold, instead of a 500", async () => {
    expect(await errorsFor(3_000_000_000)).not.toHaveLength(0);
  });

  it("accepts a very long but real playtime", async () => {
    expect(await errorsFor(500_000)).toHaveLength(0);
  });
});
