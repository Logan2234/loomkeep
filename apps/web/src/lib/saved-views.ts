import { DOMAINS } from "#lib/constants/domains.js";
import { LIBRARY_DEFAULT_STATUSES } from "#lib/constants/status-labels.js";
import type { SavedViewDto, SavedViewFiltersDto } from "@loomkeep/shared";

/** Each domain's library page. */

/** The address's spelling of "every status", on a page that opens on some. */
export const ALL_STATUSES_PARAM = "all";

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v) => b.includes(v));

/**
 * The statuses a library page's address asks for: the page's own default
 * ones when it names none, every status when it says `all`.
 */
export function statusesFromParam(
  param: string | null,
  defaultStatuses: readonly string[] = [],
): string[] {
  if (param === null) return [...defaultStatuses];
  if (param === ALL_STATUSES_PARAM) return [];
  return param.split(",").filter(Boolean);
}

/**
 * The filters as a library page's address carries them: only what differs
 * from the page's defaults, so an untouched page keeps a bare address.
 */
export function filtersToSearchParams(
  filters: SavedViewFiltersDto,
  defaultSort?: string,
  defaultStatuses: readonly string[] = [],
): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  const statuses = filters.statuses ?? [];
  if (!sameSet(statuses, defaultStatuses))
    params.set(
      "status",
      statuses.length > 0 ? statuses.join(",") : ALL_STATUSES_PARAM,
    );
  if (filters.favorite) params.set("fav", "1");
  if (filters.types?.length) params.set("type", filters.types.join(","));
  if (filters.platforms?.length)
    params.set("platform", filters.platforms.join(","));

  if (filters.sort && filters.sort !== defaultSort) {
    params.set("sort", filters.sort);
  }

  if (filters.order === "asc") params.set("order", "asc");
  return params;
}

/** The view's library page, with the view shown as applied. */
export function savedViewHref(view: SavedViewDto): string {
  const params = filtersToSearchParams(
    view.filters,
    undefined,
    LIBRARY_DEFAULT_STATUSES[view.domain],
  );
  params.set("view", view.id);
  return `${DOMAINS[view.domain].href}?${params}`;
}

/**
 * Whether two sets of filters show the same page, however an unset field is
 * spelled and in whatever order the statuses were picked.
 */
export function sameFilters(
  a: SavedViewFiltersDto,
  b: SavedViewFiltersDto,
  defaultSort: string,
  defaultStatuses: readonly string[] = [],
): boolean {
  const canonical = (f: SavedViewFiltersDto) =>
    filtersToSearchParams(
      {
        ...f,
        statuses: [...(f.statuses ?? [])].sort(),
        types: [...(f.types ?? [])].sort(),
        platforms: [...(f.platforms ?? [])].sort(),
      },
      defaultSort,
      defaultStatuses,
    ).toString();
  return canonical(a) === canonical(b);
}
