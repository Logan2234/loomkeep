import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// common/ holds what no module owns: infrastructure (HTTP, logging, CORS,
// pagination…) and pure helpers. Domain logic that four modules share lives
// in work/, a table's queries in the module that owns it. The test keeps it
// that way: nothing in common/ reaches into another module, PrismaService
// included — a Prisma type or error class from @prisma/client is fine.
describe("common/ stays free of other modules", () => {
  it("imports nothing from another module of src/", () => {
    const offenders = sourceFiles(__dirname).flatMap((file) => {
      const source = readFileSync(file, "utf-8");
      return [...source.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)]
        .map((match) => resolve(join(file, ".."), match[1]))
        .filter((target) => relative(__dirname, target).startsWith(".."))
        .map(
          (target) =>
            `${relative(__dirname, file)} imports ${relative(join(__dirname, ".."), target)}`,
        );
    });

    expect(offenders).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")
      ? [full]
      : [];
  });
}
