import type { AdminCacheResyncStaleResultDto } from "@loomkeep/shared";

export class AdminCacheResyncStaleResultResponseDto implements AdminCacheResyncStaleResultDto {
  resynced!: number;
  failed!: number;
}
