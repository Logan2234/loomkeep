import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
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

describe("request DTO classes stay linked to their shared contract", () => {
  it("every request class with a shared counterpart implements it", () => {
    const root = join(__dirname, "../../../..");
    const sharedInterfaces = new Set(
      findTypeScriptFiles(join(root, "packages/shared/src")).flatMap((file) => {
        const source = ts.createSourceFile(
          file,
          readFileSync(file, "utf8"),
          ts.ScriptTarget.Latest,
          true,
        );
        return source.statements
          .filter(ts.isInterfaceDeclaration)
          .map((node) => node.name.text);
      }),
    );
    const aliases: Record<string, string> = {
      CommentMentionBody: "CommentMentionInputDto",
      BulkUpdateEntriesBaseBody: "BulkUpdateEntriesDto",
      BulkUpdateBookEntriesBody: "BulkUpdateEntriesDto",
      BulkUpdateGameEntriesBody: "BulkUpdateEntriesDto",
      BulkUpdateMusicEntriesBody: "BulkUpdateEntriesDto",
    };
    const counterparts: string[] = [];
    const offenders: string[] = [];

    for (const file of findTypeScriptFiles(join(root, "apps/api/src")).filter(
      (file) => file.includes(`${sep}dto${sep}`),
    )) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );

      for (const cls of source.statements.filter(ts.isClassDeclaration)) {
        const name = cls.name?.text;
        if (
          !name?.endsWith("Body") ||
          !cls.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
          )
        )
          continue;
        const base = name.slice(0, -4);
        const contract =
          aliases[name] ??
          [base + "Dto", base + "RequestDto"].find((candidate) =>
            sharedInterfaces.has(candidate),
          );
        if (!contract) continue;
        counterparts.push(name);
        const implemented =
          cls.heritageClauses
            ?.filter(
              (clause) => clause.token === ts.SyntaxKind.ImplementsKeyword,
            )
            .flatMap((clause) =>
              clause.types.map((type) => type.expression.getText(source)),
            ) ?? [];
        if (!implemented.includes(contract))
          offenders.push(`${name} in ${file}`);
      }
    }

    expect(counterparts.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});

function findTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findTypeScriptFiles(full);
    return entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".spec.ts")
      ? [full]
      : [];
  });
}
