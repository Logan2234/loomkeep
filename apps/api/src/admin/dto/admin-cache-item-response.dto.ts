import type { AdminCacheItemDto } from "@loomkeep/shared/contracts";
import type { Domain } from "@loomkeep/shared/enums";

export class AdminCacheItemResponseDto implements AdminCacheItemDto {
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
}
