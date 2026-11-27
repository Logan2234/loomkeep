import { readdirSync, readFileSync } from "node:fs";

// Specs that read components as text (contracts on their markup, untranslated
// text) find them here by name: a component lives in its domain folder
// (lib/<domain>/, lib/ui/), and the spec shouldn't care which.
const LIB = new URL("../", import.meta.url);
const FILES = readdirSync(LIB, { recursive: true, encoding: "utf8" })
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => !file.startsWith("paraglide/"));

/** The source of the one file of src/lib named `name` ("Modal.svelte"). */
export function libSource(name: string): string {
  const matches = FILES.filter(
    (file) => file === name || file.endsWith(`/${name}`),
  );

  if (matches.length !== 1) {
    throw new Error(`${matches.length} files named ${name} in src/lib`);
  }

  return readFileSync(new URL(matches[0], LIB), "utf8");
}

/**
 * Every Svelte component of src/lib, by path from it, with its source; the
 * test fixtures of lib/test/ left out.
 */
export function libComponents(): { file: string; source: string }[] {
  return FILES.filter(
    (file) => file.endsWith(".svelte") && !file.startsWith("test/"),
  ).map((file) => ({
    file,
    source: readFileSync(new URL(file, LIB), "utf8"),
  }));
}
