import type { Domain } from "../enums";

import type { PagedResult } from "./pagination";
export interface AdminCacheItemDto {
  id: string;
  domain: Domain;
  title: string;
  coverUrl: string | null;
  canonicalSource: string;
  lastSyncedAt: string;
  createdAt: string;
  /** Distinct library/game/book/music entries pointing at this item, across every account. */
  referenceCount: number;
  /** Past the 24h refresh TTL. */
  stale: boolean;
  /**
   * MEDIA only: locales this item's title/overview/genres are cached in —
   * the base row's own locale first (always "en" today), then any
   * MediaItemTranslation rows. Empty for other domains, which cache one
   * language only.
   */
  cachedLocales: string[];
}

/** How the cache list is ordered. `stale` (default) surfaces the least-fresh first. */
export const ADMIN_CACHE_SORTS = ["stale", "recent", "title"] as const;

export type AdminCacheSort = (typeof ADMIN_CACHE_SORTS)[number];

export interface AdminCacheListResponseDto extends PagedResult<AdminCacheItemDto> {
  /** How many items in this domain are past the 24h TTL — drives the "resync stale" action. */
  staleTotal: number;
  /** How many items in this domain have zero references — drives the "delete orphans" action. */
  orphanTotal: number;
}

export interface AdminCacheExternalIdDto {
  source: string;
  externalId: string;
}

/**
 * Full detail of one cached item, shown in the admin cache drawer. Deliberately
 * light on catalogue metadata (overview, genres…) — that lives on the item's own
 * Loomkeep page, linked via `detailPath`; the drawer focuses on cache state.
 */
export interface AdminCacheItemDetailDto extends AdminCacheItemDto {
  /** When the DB row itself last changed (distinct from `lastSyncedAt`). */
  updatedAt: string;
  externalIds: AdminCacheExternalIdDto[];
  /** MEDIA only: seasons with their episode counts. Empty for other domains. */
  seasons: { number: number; title: string | null; episodeCount: number }[];
  /** In-app path to this item's public Loomkeep page (e.g. `/media/series/1396`). */
  detailPath: string;
}

/** Outcome of re-syncing every stale item in a domain. */
export interface AdminCacheResyncStaleResultDto {
  /** Items that refreshed successfully. */
  resynced: number;
  /** Items whose source refresh failed (left untouched). */
  failed: number;
}

/** Outcome of purging every orphaned (unreferenced) item in a domain. */
export interface AdminCacheDeleteOrphansResultDto {
  /** Items removed from the cache. */
  deleted: number;
  /** Orphans left alone because a review/comment/activity row still targets them. */
  skipped: number;
}
