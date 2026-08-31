import type { AdminCacheItemDetailDto, Domain } from "@loomkeep/shared";

class AdminCacheExternalIdResponseDto {
  source!: string;
  externalId!: string;
}

class AdminCacheSeasonResponseDto {
  number!: number;
  title!: string | null;
  episodeCount!: number;
}

export class AdminCacheItemDetailResponseDto implements AdminCacheItemDetailDto {
  id!: string;
  domain!: Domain;
  title!: string;
  coverUrl!: string | null;
  canonicalSource!: string;
  lastSyncedAt!: string;
  createdAt!: string;
  referenceCount!: number;
  stale!: boolean;
  cachedLocales!: string[];
  updatedAt!: string;
  externalIds!: AdminCacheExternalIdResponseDto[];
  seasons!: AdminCacheSeasonResponseDto[];
  detailPath!: string;
}
