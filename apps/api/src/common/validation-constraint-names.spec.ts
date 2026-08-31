import { VALIDATION_CONSTRAINT_NAMES } from "@loomkeep/shared";
import { getMetadataStorage } from "class-validator";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import "reflect-metadata";

// Guardrail for the "Translate form validation errors" ticket: every
// class-validator constraint actually used by a DTO in this app must be
// registered in VALIDATION_CONSTRAINT_NAMES (packages/shared), or apps/web's
// translation table (validation-messages.ts) has no way of knowing it needs
// an entry for it — a silent gap, not a crash, since resolveFieldError()
// falls back to a generic per-field message. This test turns that gap into
// a build failure instead.
describe("validation constraint registry stays in sync with the DTOs", () => {
  // Dynamically imports every *.dto.ts file in the app — the growing count
  // of response DTOs (no validators of their own, but still imported here)
  // pushed this past the default 5s timeout.
  it("covers every class-validator constraint name used across all DTOs", async () => {
    const dtoFiles = findDtoFiles(join(__dirname, ".."));
    const usedNames = new Set<string>();

    for (const file of dtoFiles) {
      const mod: Record<string, unknown> = await import(
        pathToFileURL(file).href
      );

      for (const exported of Object.values(mod)) {
        if (typeof exported !== "function") continue;

        const metadatas = getMetadataStorage().getTargetValidationMetadatas(
          exported as new (...args: unknown[]) => unknown,
          "",
          true,
          false,
        );

        for (const metadata of metadatas) {
          // "conditionalValidation" is @IsOptional()'s type — it gates
          // whether later validators run and can never itself appear as a
          // key in a ValidationError's `constraints`, so it needs no
          // translation entry. Every real constraint (MinLength, IsEmail...)
          // registers as CUSTOM_VALIDATION regardless of its `.name` — see
          // registerDecorator in class-validator.
          if (metadata.type === "conditionalValidation") continue;
          if (metadata.name) usedNames.add(metadata.name);
        }
      }
    }

    const registered = new Set<string>(VALIDATION_CONSTRAINT_NAMES);
    const missing = [...usedNames].filter((name) => !registered.has(name));

    expect(missing).toEqual([]);
  }, 20_000);
});

function findDtoFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findDtoFiles(full);
    if (entry.isFile() && entry.name.endsWith(".dto.ts")) return [full];
    return [];
  });
}
