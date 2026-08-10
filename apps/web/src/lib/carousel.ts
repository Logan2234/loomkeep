// Maps a list of catalogue summaries to the item shape RelatedCarousel expects.

interface CarouselSource {
  sourceId: string;
  coverUrl: string | null;
  title: string;
}

export interface CarouselItem {
  key: string;
  href: string;
  cover: string | null;
  title: string;
}

/**
 * Builds RelatedCarousel items from summaries sharing a source id, linking each
 * to `${hrefPrefix}/${sourceId}` (e.g. "/app/games", "/app/books").
 */
export function toCarouselItems(
  list: CarouselSource[],
  hrefPrefix: string,
): CarouselItem[] {
  return list.map((x) => ({
    key: x.sourceId,
    href: `${hrefPrefix}/${x.sourceId}`,
    cover: x.coverUrl,
    title: x.title,
  }));
}
