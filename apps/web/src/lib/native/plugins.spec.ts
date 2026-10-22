import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Manifest = { dependencies?: Record<string, string> };

const read = (path: string): Manifest =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Manifest;

const web = read("../../../package.json");
const mobile = read("../../../../mobile/package.json");

/** Capacitor's core and its plugins, official (@capacitor/*) or not (@capacitor-mlkit/*…). */
const isCapacitor = (name: string) => /^@capacitor(-[\w-]+)?\//.test(name);

describe("Capacitor plugins", () => {
  // The web runs a plugin's JavaScript side, the APK its native side: one
  // missing from apps/mobile is never in the app, and different versions
  // can disagree on the bridge between the two.
  it("are in the Android app, at the version the web uses", () => {
    const used = Object.entries(web.dependencies ?? {}).filter(([name]) =>
      isCapacitor(name),
    );

    expect(used.length).toBeGreaterThan(0);

    for (const [name, version] of used) {
      expect({ name, version: mobile.dependencies?.[name] }).toEqual({
        name,
        version,
      });
    }
  });
});
