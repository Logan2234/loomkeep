import type { AdminCacheDeleteOrphansResultDto } from "@loomkeep/shared";

export class AdminCacheDeleteOrphansResultResponseDto implements AdminCacheDeleteOrphansResultDto {
  deleted!: number;
  skipped!: number;
}
