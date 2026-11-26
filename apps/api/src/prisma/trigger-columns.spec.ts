import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { prismaWrites, sourceFiles } from "../test-utils/prisma-writes";

// Postgres triggers keep these columns equal to what the rows they count say
// (docs/adr/0006-progress-counters-by-trigger.md). A write from the app
// would race the trigger and leave a wrong count, without an error.
const TRIGGER_COLUMNS: Record<string, string[]> = {
  mediaEntry: ["watchedEpisodes", "lastWatchedAt"],
  mediaItem: ["episodeCount"],
};
const ALL_COLUMNS = Object.values(TRIGGER_COLUMNS).flat();

describe("columns maintained by triggers", () => {
  it("are never written through Prisma", () => {
    const offenders = prismaWrites()
      .filter(({ model }) => model in TRIGGER_COLUMNS)
      .flatMap(({ file, line, model, args }) =>
        TRIGGER_COLUMNS[model]
          .filter((column) => new RegExp(`\\b${column}\\s*:`).test(args))
          .map((column) => `${file}:${line} writes ${model}.${column}`),
      );

    expect(offenders).toEqual([]);
  });

  it("are never written in raw SQL", () => {
    const assignment = new RegExp(
      `SET[^;\`]*"(${ALL_COLUMNS.join("|")})"\\s*=`,
      "i",
    );
    const offenders = sourceFiles()
      .filter((file) => assignment.test(readFileSync(file, "utf-8")))
      .map((file) => relative(join(__dirname, ".."), file));

    expect(offenders).toEqual([]);
  });
});
