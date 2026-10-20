import {
  ADMIN_CACHE_SORTS,
  type AdminCacheDeleteOrphansResultDto,
  type AdminCacheItemDetailDto,
  type AdminCacheListResponseDto,
  type AdminCacheResyncStaleResultDto,
} from "@loomkeep/shared";
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { DEFAULT_PAGE_SIZE, parsePageQuery } from "../common/pagination.util";
import { parseEnumParam } from "../common/parse-enum-param.util";
import {
  AdminCacheService,
  CACHE_DOMAINS,
  type CacheDomain,
} from "./admin-cache.service";
import { AdminOnly } from "./admin-only.decorator";
import { AdminCacheDeleteOrphansResultResponseDto } from "./dto/admin-cache-delete-orphans-result-response.dto";
import { AdminCacheItemDetailResponseDto } from "./dto/admin-cache-item-detail-response.dto";
import { AdminCacheListResultResponseDto } from "./dto/admin-cache-list-response.dto";
import { AdminCacheResyncStaleResultResponseDto } from "./dto/admin-cache-resync-stale-result-response.dto";

/** Browse the on-demand catalogue cache: list, inspect, re-sync and prune. */
@AdminOnly()
@Controller("admin")
export class AdminCacheController {
  constructor(private readonly cache: AdminCacheService) {}

  /**
   * Cached items for one domain, ordered by `sort` and optionally scoped to
   * orphans, plus the domain-wide stale/orphan subtotals that drive the bulk
   * actions (those counts ignore search/orphans so they reflect the whole domain).
   */
  @Get("cache")
  @ApiOkResponse({ type: AdminCacheListResultResponseDto })
  list(
    @Query("domain") domain: string,
    @Query("search") search?: string,
    @Query("sort") sort?: string,
    @Query("orphans") orphans?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<AdminCacheListResponseDto> {
    return this.cache.list(domainOrThrow(domain), {
      ...parsePageQuery(page, limit, DEFAULT_PAGE_SIZE),
      search: search?.trim(),
      sort: ADMIN_CACHE_SORTS.find((value) => value === sort) ?? "stale",
      orphansOnly: orphans === "true",
    });
  }

  /** Cache-state detail of one item (freshness, external ids, media seasons, in-app link). */
  @Get("cache/:domain/:id")
  @ApiOkResponse({ type: AdminCacheItemDetailResponseDto })
  detail(
    @Param("domain") domain: string,
    @Param("id") id: string,
  ): Promise<AdminCacheItemDetailDto> {
    return this.cache.detail(domainOrThrow(domain), id);
  }

  /** Forces a re-sync from the canonical source, bypassing the 24h TTL. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("cache/:domain/:id/resync")
  resync(
    @Param("domain") domain: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.cache.resync(domainOrThrow(domain), id);
  }

  /** Re-syncs every stale (>24h) item in a domain in one pass. */
  @Post("cache/:domain/resync-stale")
  @ApiCreatedResponse({ type: AdminCacheResyncStaleResultResponseDto })
  resyncStale(
    @Param("domain") domain: string,
  ): Promise<AdminCacheResyncStaleResultDto> {
    return this.cache.resyncStale(domainOrThrow(domain));
  }

  /**
   * Purges every orphaned item in a domain, skipping those that still carry
   * content. Declared before the `:id` delete so "orphans" isn't swallowed
   * as an id.
   */
  @Delete("cache/:domain/orphans")
  @ApiOkResponse({ type: AdminCacheDeleteOrphansResultResponseDto })
  removeOrphans(
    @Param("domain") domain: string,
  ): Promise<AdminCacheDeleteOrphansResultDto> {
    return this.cache.removeOrphans(domainOrThrow(domain));
  }

  /** Deletes one orphaned cached item; 409 while an account or content still references it. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("cache/:domain/:id")
  remove(
    @Param("domain") domain: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.cache.remove(domainOrThrow(domain), id);
  }
}

function domainOrThrow(domain: string): CacheDomain {
  return parseEnumParam(domain, CACHE_DOMAINS, "cache domain", {
    caseSensitive: true,
    message: `Unknown cache domain: ${domain}`,
  });
}
