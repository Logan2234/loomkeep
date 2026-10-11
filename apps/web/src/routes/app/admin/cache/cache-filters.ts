import { DOMAINS, DOMAIN_IDS } from "#lib/constants/domains.js";
import { enumParam } from "#lib/url-params.js";
import { Domain, type AdminCacheSort } from "@loomkeep/shared";

export function parseCacheFilters(params: Pick<URLSearchParams, "get">): {
  domain: Domain;
  sort: AdminCacheSort;
  orphansOnly: boolean;
  search: string;
} {
  const domain = enumParam(
    params,
    "domain",
    DOMAIN_IDS.filter((id) => !DOMAINS[id].comingSoon),
    Domain.MEDIA,
  );
  const sort: AdminCacheSort = enumParam(
    params,
    "sort",
    ["recent", "title", "stale"] as const,
    "stale",
  );

  return {
    domain,
    sort,
    orphansOnly: params.get("orphans") === "1",
    search: params.get("q")?.trim() ?? "",
  };
}
