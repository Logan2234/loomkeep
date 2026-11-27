export type CarouselDot = {
  page: number;
  kind: "dot" | "more-before" | "more-after";
};

/**
 * The page dots to draw: at most `max`, following the current page. Where
 * pages remain beyond an end, its dot turns into a chevron, and turns back
 * once that end is in reach. A dot per page would outgrow the screen on a
 * long strip, and widen the whole page with it.
 */
export function getCarouselDots(
  pageCount: number,
  pageIndex: number,
  max = 5,
): CarouselDot[] {
  const shown = Math.min(pageCount, max);
  const start = Math.max(
    0,
    Math.min(pageIndex - Math.floor(max / 2), pageCount - shown),
  );

  return Array.from({ length: shown }, (_, offset) => {
    const page = start + offset;
    if (offset === 0 && start > 0) return { page, kind: "more-before" };

    if (offset === shown - 1 && page < pageCount - 1) {
      return { page, kind: "more-after" };
    }

    return { page, kind: "dot" };
  });
}

export function getCarouselPageOffsets(
  scrollWidth: number,
  clientWidth: number,
): number[] {
  if (clientWidth <= 0 || scrollWidth <= clientWidth) return [0];

  const maxScroll = scrollWidth - clientWidth;
  const pageCount = Math.ceil(scrollWidth / clientWidth);
  const offsets: number[] = [];

  for (let index = 0; index < pageCount; index++) {
    const offset = Math.min(index * clientWidth, maxScroll);
    const previous = offsets.at(-1);

    if (previous !== undefined && offset - previous <= 8) {
      if (offsets.length > 1) offsets[offsets.length - 1] = offset;
      continue;
    }

    offsets.push(offset);
  }

  return offsets;
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
