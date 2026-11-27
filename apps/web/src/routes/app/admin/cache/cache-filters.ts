import { DOMAINS, DOMAIN_IDS } from "#lib/constants/domains.js";
import { enumParam } from "#lib/shell/url-params.js";
import { type AdminCacheSort } from "@loomkeep/shared/contracts";
import { Domain } from "@loomkeep/shared/enums";

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
