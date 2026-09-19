import { DOMAINS } from "$lib/constants/domains";
import { Domain, type AdminCacheSort } from "@loomkeep/shared";

export function parseCacheFilters(params: URLSearchParams): {
  domain: Domain;
  sort: AdminCacheSort;
  orphansOnly: boolean;
  search: string;
} {
  const requestedDomain = params.get("domain") as Domain;
  const domain =
    DOMAINS[requestedDomain] && !DOMAINS[requestedDomain].comingSoon
      ? requestedDomain
      : Domain.MEDIA;
  const requestedSort = params.get("sort");
  const sort: AdminCacheSort =
    requestedSort === "recent" || requestedSort === "title"
      ? requestedSort
      : "stale";

  return {
    domain,
    sort,
    orphansOnly: params.get("orphans") === "1",
    search: params.get("q")?.trim() ?? "",
  };
}
