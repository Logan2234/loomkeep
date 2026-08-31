import { m } from "$lib/paraglide/messages.js";
import { getLocale, overwriteGetLocale } from "$lib/paraglide/runtime.js";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "svelte/compiler";
import { describe, expect, it } from "vitest";
import { POSSESSION_STATUS_LABEL } from "./stats/possession-labels";
import { STATS_DOMAIN_LABEL, STATUS_BUCKET_LABEL } from "./stats/stats-domain";

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
  "hint",
  "unit",
  "emptyText",
  "confirmLabel",
  "cancelLabel",
  "suffix",
]);
// Brand initial and version marker, not natural-language messages.
const technicalText = new Set(["L", "V"]);

function visit(value: unknown, check: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value))
    return value.forEach((child) => visit(child, check));
  const node = value as Record<string, unknown>;
  if (node.type === "Attribute" && !textAttributes.has(String(node.name)))
    return;
  check(node);

  for (const [key, child] of Object.entries(node)) {
    if (!["metadata", "loc", "css"].includes(key)) visit(child, check);
  }
}

describe("shared component translations", () => {
  it("provides singular and plural counter messages in both languages", () => {
    for (const locale of ["fr", "en"] as const) {
      expect(m.stats_approx_day({ days: 1 }, { locale })).toBe(
        locale === "fr" ? "≈ 1 jour" : "≈ 1 day",
      );
      expect(m.stats_approx_days({ days: 2 }, { locale })).toBe(
        locale === "fr" ? "≈ 2 jours" : "≈ 2 days",
      );
      expect(m.comments_more_replies_one({ count: 1 }, { locale })).toBe(
        locale === "fr" ? "+1 réponse" : "+1 reply",
      );
      expect(m.comments_more_replies_many({ count: 2 }, { locale })).toBe(
        locale === "fr" ? "+2 réponses" : "+2 replies",
      );
      expect(m.lists_work_count_one({ count: 1 }, { locale })).toBe(
        locale === "fr" ? "1 œuvre" : "1 work",
      );
      expect(m.lists_work_count_many({ count: 2 }, { locale })).toBe(
        locale === "fr" ? "2 œuvres" : "2 works",
      );
    }
  });

  it("resolves shared statistics labels in the active language on each read", () => {
    const previous = getLocale;

    try {
      for (const locale of ["fr", "en"] as const) {
        overwriteGetLocale(() => locale);
        expect(STATS_DOMAIN_LABEL.BOOKS).toBe(
          locale === "fr" ? "Livres" : "Books",
        );
        expect(STATUS_BUCKET_LABEL.PLANNED).toBe(
          locale === "fr" ? "À faire" : "To do",
        );
        expect(STATUS_BUCKET_LABEL.IN_PROGRESS).toBe(
          locale === "fr" ? "En cours" : "In progress",
        );
        expect(STATUS_BUCKET_LABEL.DONE).toBe(
          locale === "fr" ? "Terminé" : "Completed",
        );
        expect(POSSESSION_STATUS_LABEL.BORROWED).toBe(
          locale === "fr" ? "Emprunté" : "Borrowed",
        );
        expect(POSSESSION_STATUS_LABEL.DIGITAL).toBe(
          locale === "fr" ? "Numérique" : "Digital",
        );
      }
    } finally {
      overwriteGetLocale(previous);
    }
  });

  it("does not embed untranslated phrases in dynamic text attributes", () => {
    const missing: string[] = [];

    for (const file of readdirSync(new URL("./", import.meta.url), {
      recursive: true,
      encoding: "utf8",
    }).filter((path) => path.endsWith(".svelte"))) {
      const source = readFileSync(
        new URL(file.replaceAll("\\", "/"), import.meta.url),
        "utf8",
      );
      visit(parse(source, { modern: true }), (node) => {
        if (node.type !== "Attribute" || !textAttributes.has(String(node.name)))
          return;
        visit(node.value, (part) => {
          const value =
            part.type === "Literal"
              ? part.value
              : part.type === "TemplateElement"
                ? (part.value as { raw: string }).raw
                : null;

          if (
            typeof value === "string" &&
            /\p{L}[\p{L}'-]*\s+\p{L}/u.test(value)
          ) {
            missing.push(`${file}: ${node.name}: ${value}`);
          }
        });
      });
    }

    expect(missing).toEqual([]);
  });

  it("translates visible text and static accessibility attributes", () => {
    const missing: string[] = [];

    for (const file of readdirSync(new URL("./", import.meta.url), {
      recursive: true,
      encoding: "utf8",
    }).filter((path) => path.endsWith(".svelte"))) {
      const source = readFileSync(
        new URL(file.replaceAll("\\", "/"), import.meta.url),
        "utf8",
      );
      visit(parse(source, { modern: true }), (node) => {
        if (node.type !== "Text") return;
        const text = String(node.data).trim();
        if (/\p{L}/u.test(text) && !technicalText.has(text))
          missing.push(`${file}: ${text}`);
      });
    }

    expect(missing).toEqual([]);
  });
});
