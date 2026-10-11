interface GalleryImage {
  src: string;
  alt: string;
}

export function buildGallery(
  title: string,
  images: readonly { src: string | null | undefined; alt?: string }[],
  deduplicate = true,
): GalleryImage[] {
  const seen = new Set<string>();
  return images.flatMap((image) => {
    if (
      image.src === null ||
      image.src === undefined ||
      (deduplicate && seen.has(image.src))
    )
      return [];
    seen.add(image.src);
    return [{ src: image.src, alt: image.alt ?? title }];
  });
}

export function galleryIndex(
  images: readonly GalleryImage[],
  url: string,
  offset = 0,
): number {
  const index = images.findIndex((image) => image.src === url);
  return Math.max(0, index) + offset;
}
