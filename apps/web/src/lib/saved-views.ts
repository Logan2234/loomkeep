import type {
  SavedViewDomain,
  SavedViewDto,
  SavedViewFiltersDto,
} from "@loomkeep/shared";

/** Each domain's library page. */
const LIBRARY_HREF: Record<SavedViewDomain, string> = {
  MEDIA: "/app/media",
  GAMES: "/app/games",
  BOOKS: "/app/books",
  MUSIC: "/app/music",
};

/**
 * The filters as a library page's address carries them: only what differs
 * from the page's defaults, so an untouched page keeps a bare address.
 */
export function filtersToSearchParams(
  filters: SavedViewFiltersDto,
  defaultSort?: string,
): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  if (filters.statuses?.length)
    params.set("status", filters.statuses.join(","));
  if (filters.favorite) params.set("fav", "1");
  if (filters.types?.length) params.set("type", filters.types.join(","));

  if (filters.sort && filters.sort !== defaultSort) {
    params.set("sort", filters.sort);
  }

  if (filters.order === "asc") params.set("order", "asc");
  return params;
}

/** The view's library page, with the view shown as applied. */
export function savedViewHref(view: SavedViewDto): string {
  const params = filtersToSearchParams(view.filters);
  params.set("view", view.id);
  return `${LIBRARY_HREF[view.domain]}?${params}`;
}

/**
 * Whether two sets of filters show the same page, however an unset field is
 * spelled and in whatever order the statuses were picked.
 */
export function sameFilters(
  a: SavedViewFiltersDto,
  b: SavedViewFiltersDto,
  defaultSort: string,
): boolean {
  const canonical = (f: SavedViewFiltersDto) =>
    filtersToSearchParams(
      {
        ...f,
        statuses: [...(f.statuses ?? [])].sort(),
        types: [...(f.types ?? [])].sort(),
      },
      defaultSort,
    ).toString();
  return canonical(a) === canonical(b);
}
