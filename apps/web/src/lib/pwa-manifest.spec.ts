import { describe, expect, it } from "vitest";
import { createManifest } from "./pwa-manifest";

describe("localized PWA manifest", () => {
  it("keeps installation identity, launch URL and icons independent of locale", () => {
    const en = createManifest("en");
    const fr = createManifest("fr");
    expect(en.id).toBe("/");
    expect(en.id).toBe(fr.id);
    expect(en.start_url).toBe("/app");
    expect(en.start_url).toBe(fr.start_url);
    expect(en.icons).toEqual(fr.icons);
    expect(en.shortcuts.map((shortcut) => shortcut.url)).toEqual(
      fr.shortcuts.map((shortcut) => shortcut.url),
    );
  });
});
