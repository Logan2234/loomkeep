export function getCarouselPageOffsets(
  scrollWidth: number,
  clientWidth: number,
): number[] {
  if (clientWidth <= 0 || scrollWidth <= clientWidth) return [0];

  const maxScroll = scrollWidth - clientWidth;
  const pageCount = Math.ceil(scrollWidth / clientWidth);
  return Array.from({ length: pageCount }, (_, index) =>
    Math.min(index * clientWidth, maxScroll),
  );
}

export function getCarouselPageIndex(
  scrollLeft: number,
  offsets: number[],
): number {
  return offsets.reduce(
    (nearest, offset, index) =>
      Math.abs(offset - scrollLeft) < Math.abs(offsets[nearest] - scrollLeft)
        ? index
        : nearest,
    0,
  );
}

export function getAdjacentCarouselOffset(
  scrollLeft: number,
  offsets: number[],
  direction: 1 | -1,
): number {
  const current = getCarouselPageIndex(scrollLeft, offsets);
  const next = Math.max(0, Math.min(offsets.length - 1, current + direction));
  return offsets[next];
}
