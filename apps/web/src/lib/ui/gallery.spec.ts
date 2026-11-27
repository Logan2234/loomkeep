import { describe, expect, it } from "vitest";
import { buildGallery, galleryIndex } from "./gallery";
describe("work galleries", () => {
  it("keeps cover-first order while deduplicating screenshots and skipping missing covers", () => {
    expect(
      buildGallery("Title", [
        { src: "cover" },
        { src: null },
        { src: "cover" },
        { src: "shot" },
      ]),
    ).toEqual([
      { src: "cover", alt: "Title" },
      { src: "shot", alt: "Title" },
    ]);
  });
  it("preserves archive captions and repeated music artwork", () => {
    expect(
      buildGallery(
        "Album",
        [{ src: "cover" }, { src: "cover", alt: "Album — Back" }],
        false,
      ),
    ).toEqual([
      { src: "cover", alt: "Album" },
      { src: "cover", alt: "Album — Back" },
    ]);
  });
  it("accounts for the trailer slide and falls back to the first image", () => {
    const images = buildGallery("Game", [{ src: "cover" }, { src: "shot" }]);
    expect(galleryIndex(images, "shot", 1)).toBe(2);
    expect(galleryIndex(images, "unknown", 1)).toBe(1);
    expect(galleryIndex(images, "cover")).toBe(0);
  });
});
