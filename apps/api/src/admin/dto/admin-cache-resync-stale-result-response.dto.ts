import type { AdminCacheResyncStaleResultDto } from "@loomkeep/shared/contracts";

export class AdminCacheResyncStaleResultResponseDto implements AdminCacheResyncStaleResultDto {
  resynced!: number;
  failed!: number;
}
