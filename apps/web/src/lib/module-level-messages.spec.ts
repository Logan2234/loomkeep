import { describe, expect, it, vi } from "vitest";

// Labels kept in module-level constants must follow the locale at read time:
// initAuth applies the account's locale without a reload, after these
// modules were imported. A label computed at import stays in the old one.

async function importAll(locale: "en" | "fr") {
  vi.resetModules();
  const { overwriteGetLocale } = await import("./paraglide/runtime.js");
  overwriteGetLocale(() => locale);
  const loaders = import.meta.glob<Record<string, unknown>>([
    "./constants/*.ts",
    "./privacy-options.ts",
    "./navigation.ts",
    "./nav-style.svelte.ts",
    "../routes/app/settings/nav.ts",
    "!./**/*.spec.ts",
  ]);
  const loaded = await Promise.all(
    Object.entries(loaders).map(async ([file, load]) => [file, await load()]),
  );
  return { exports: Object.fromEntries(loaded), overwriteGetLocale };
}

/** Every string reachable from `value`, by path. */
function strings(
  value: unknown,
  path = "",
  seen = new Set<unknown>(),
): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  return Object.keys(value).flatMap((key) =>
    strings((value as Record<string, unknown>)[key], `${path}/${key}`, seen),
  );
}

describe("module-level messages", () => {
  it("read their translation when used, not when imported", async () => {
    const expected = new Map(strings((await importAll("fr")).exports));
    const { exports, overwriteGetLocale } = await importAll("en");
    overwriteGetLocale(() => "fr");

    const frozen = strings(exports)
      .filter(([path, text]) => expected.get(path) !== text)
      .map(([path]) => path);

    expect(frozen).toEqual([]);
  });
});
