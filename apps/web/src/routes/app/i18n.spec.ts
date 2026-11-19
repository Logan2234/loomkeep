import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "svelte/compiler";
import { describe, expect, it } from "vitest";

const routeDirectory = fileURLToPath(new URL("./", import.meta.url));
const routes = readdirSync(routeDirectory, {
  recursive: true,
  encoding: "utf8",
})
  .filter((file) => file.endsWith(".svelte"))
  .map((file) => ({
    file,
    source: readFileSync(
      new URL(file.replaceAll("\\", "/"), import.meta.url),
      "utf8",
    ),
  }));
// Every catalog file of each locale, merged.
const catalogs = Object.fromEntries(
  ["fr", "en"].map((locale) => {
    const directory = new URL(`../../../messages/${locale}/`, import.meta.url);
    const merged: Record<string, string> = Object.assign(
      {},
      ...readdirSync(directory).map((file) =>
        JSON.parse(readFileSync(new URL(file, directory), "utf8")),
      ),
    );
    return [locale, merged];
  }),
);
const textAttributes = new Set([
  "title",
  "subtitle",
  "label",
  "description",
  "placeholder",
  "alt",
  "aria-label",
  "message",
  "help",
  "emptyText",
  "noun",
  "confirmLabel",
  "cancelLabel",
]);
// Technical tokens and proper names do not depend on the interface locale.
const untranslatedAttributes = new Set([
  "Loomkeep (admin)",
  "000000",
  "XXXXX-XXXXX",
]);

function visit(value: unknown, check: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((child) => visit(child, check));
    return;
  }

  const node = value as Record<string, unknown>;
  check(node);

  for (const [key, child] of Object.entries(node)) {
    if (key !== "metadata" && key !== "loc") visit(child, check);
  }
}

describe("app route translations", () => {
  it("translates static user-facing attributes", () => {
    const missing: string[] = [];

    for (const { file, source } of routes) {
      visit(parse(source, { modern: true }), (node) => {
        if (node.type !== "Attribute" || !textAttributes.has(String(node.name)))
          return;
        if (!Array.isArray(node.value)) return;

        for (const part of node.value) {
          if (part.type !== "Text") continue;
          const text = part.data.trim();

          if (/[\p{L}]/u.test(text) && !untranslatedAttributes.has(text)) {
            missing.push(`${file}: ${node.name}="${text}"`);
          }
        }
      });
    }

    expect(missing).toEqual([]);
  });

  it("provides matching French and English messages for every route key", () => {
    const keys = new Set<string>();

    for (const { source } of routes) {
      visit(parse(source, { modern: true }), (node) => {
        if (node.type !== "MemberExpression" || node.computed) return;
        const object = node.object as { type: string; name?: string };
        const property = node.property as { type: string; name: string };

        if (
          object.type === "Identifier" &&
          object.name === "m" &&
          property.type === "Identifier"
        ) {
          keys.add(property.name);
        }
      });
    }

    for (const key of keys) {
      for (const [locale, catalog] of Object.entries(catalogs)) {
        expect(catalog[key], `${locale}: ${key}`).toBeTypeOf("string");
        expect(catalog[key].trim(), `${locale}: ${key}`).not.toBe("");
      }

      const parameters = (text: string) =>
        [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
      expect(parameters(catalogs.en[key]), key).toEqual(
        parameters(catalogs.fr[key]),
      );
    }
  });
});
