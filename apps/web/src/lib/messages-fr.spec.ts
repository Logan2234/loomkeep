import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The French catalogue addresses the reader informally ("tu"), and calls a
// written opinion a "critique" — "review" stays an internal name. Both used to
// drift screen by screen, which is what this locks down.
const MESSAGES_DIR = new URL("../../messages/fr/", import.meta.url);

// Enum values quoted verbatim in an admin field's help text.
const TECHNICAL_KEYS = new Set(["admin_template_measure"]);

const FORMAL = /\b(vous|votre|vos)\b/i;
const REVIEW = /\breviews?\b/i;

function entries(): [string, string][] {
  const found: [string, string][] = [];

  for (const file of readdirSync(MESSAGES_DIR)) {
    if (!file.endsWith(".json")) continue;
    const catalogue: Record<string, unknown> = JSON.parse(
      readFileSync(new URL(file, MESSAGES_DIR), "utf8"),
    );

    for (const [key, value] of Object.entries(catalogue)) {
      if (key.startsWith("$") || typeof value !== "string") continue;
      if (!TECHNICAL_KEYS.has(key)) found.push([key, value]);
    }
  }

  return found;
}

describe("French message catalogue", () => {
  it("addresses the reader informally", () => {
    const formal = entries().filter(([, value]) => FORMAL.test(value));

    expect(formal).toEqual([]);
  });

  it("says « critique » rather than « review »", () => {
    const anglicised = entries().filter(([, value]) => REVIEW.test(value));

    expect(anglicised).toEqual([]);
  });
});
