import { readFileSync } from "node:fs";
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
    expect(en.share_target).toEqual(fr.share_target);
    expect(en.share_target.action).toBe("/app/share");
    expect(en.shortcuts.map((shortcut) => shortcut.url)).toEqual(
      fr.shortcuts.map((shortcut) => shortcut.url),
    );
  });
});

// The file's first bytes, not its extension, say what it is. A screenshot
// saved as JPEG under a .png name was served and declared as PNG.
const SIGNATURES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

describe("PWA manifest images", () => {
  const { icons, screenshots } = createManifest("en");
  const raster = [...icons, ...screenshots].filter(
    (image) => image.type in SIGNATURES,
  );

  it.each(raster.map((image) => [image.src, image.type]))(
    "%s really is %s",
    (src, type) => {
      const bytes = readFileSync(
        new URL(`../../static${src}`, import.meta.url),
      );
      const signature = SIGNATURES[type];

      expect([...bytes.subarray(0, signature.length)]).toEqual(signature);
    },
  );
});
