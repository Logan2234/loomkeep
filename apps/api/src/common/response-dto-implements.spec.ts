import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// Guardrail for the "typed API responses" effort: a *-response.dto.ts class
// exists purely so @nestjs/swagger has something to read (TS interfaces
// carry no runtime metadata, so the plugin can't infer a schema from
// packages/shared's DTOs directly) — its fields must stay in lockstep with
// the interface it mirrors. `implements` is what enforces that: without it,
// the class can silently drift from packages/shared with nothing to catch
// it, which is exactly the "two declarations, no link" problem this
// pattern exists to avoid, just moved from routes to response shapes.
describe("response DTO classes stay linked to their shared interface", () => {
  it("every exported class in a *-response.dto.ts file has an `implements` clause", () => {
    const files = findResponseDtoFiles(join(__dirname, ".."));
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.flatMap((file) => {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf-8"),
        ts.ScriptTarget.Latest,
        true,
      );

      return source.statements
        .filter(ts.isClassDeclaration)
        .filter((cls) => {
          const isExported = cls.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.ExportKeyword,
          );
          const implementsSomething = cls.heritageClauses?.some(
            (h) => h.token === ts.SyntaxKind.ImplementsKeyword,
          );
          return isExported && !implementsSomething;
        })
        .map((cls) => `${cls.name?.text ?? "<anonymous>"} in ${file}`);
    });

    expect(offenders).toEqual([]);
  });
});

function findResponseDtoFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findResponseDtoFiles(full);

    if (entry.isFile() && entry.name.endsWith("-response.dto.ts")) {
      return [full];
    }

    return [];
  });
}
