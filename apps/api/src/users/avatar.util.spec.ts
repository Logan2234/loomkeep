import sharp from "sharp";
import { reencodeAvatar, STORED_AVATAR_MIME_TYPE } from "./avatar.util";

/** A JPEG carrying an EXIF block, the way a phone camera produces one. */
async function photoWithExif(width = 800, height = 600): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  })
    .withExif({
      IFD0: { Software: "Loomkeep test", Model: "Pixel" },
      // IFD3 is the GPS directory — where a phone writes the shot's
      // coordinates, and the reason this whole block must not survive.
      IFD3: { GPSLatitudeRef: "N", GPSLongitudeRef: "E" },
    })
    .jpeg()
    .toBuffer();
}

describe("reencodeAvatar", () => {
  it("strips the EXIF block, GPS included", async () => {
    // The reason this function exists: avatars are served back with a
    // year-long immutable cache, so an untouched EXIF block publishes where
    // the photo was taken.
    const original = await photoWithExif();
    expect(await sharp(original).metadata()).toHaveProperty("exif");

    const cleaned = await reencodeAvatar(original);

    expect((await sharp(cleaned).metadata()).exif).toBeUndefined();
  });

  it("stores WebP whatever was uploaded", async () => {
    const cleaned = await reencodeAvatar(await photoWithExif());

    const { format } = await sharp(cleaned).metadata();
    expect(`image/${format}`).toBe(STORED_AVATAR_MIME_TYPE);
  });

  it("bounds the stored image to the display size", async () => {
    const cleaned = await reencodeAvatar(await photoWithExif(2000, 1500));

    const { width, height } = await sharp(cleaned).metadata();
    expect(Math.max(width!, height!)).toBe(512);
    // Aspect ratio preserved — `fit: inside`, not a crop.
    expect(width! / height!).toBeCloseTo(2000 / 1500, 1);
  });

  it("leaves a picture smaller than the cap alone rather than upscaling it", async () => {
    const cleaned = await reencodeAvatar(await photoWithExif(64, 64));

    const { width } = await sharp(cleaned).metadata();
    expect(width).toBe(64);
  });

  it("rejects bytes it cannot decode", async () => {
    // A PNG header glued onto something that isn't an image passes the magic
    // byte check upstream; this is what actually stops it.
    const notAnImage = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("<script>alert(1)</script>"),
    ]);

    await expect(reencodeAvatar(notAnImage)).rejects.toThrow();
  });

  it("re-emits its own bytes, so nothing of the upload survives verbatim", async () => {
    const original = await photoWithExif();

    const cleaned = await reencodeAvatar(original);

    expect(Buffer.from(cleaned).equals(original)).toBe(false);
  });
});
