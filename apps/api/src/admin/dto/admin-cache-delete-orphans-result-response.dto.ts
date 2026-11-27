import type { AdminCacheDeleteOrphansResultDto } from "@loomkeep/shared/contracts";

export class AdminCacheDeleteOrphansResultResponseDto implements AdminCacheDeleteOrphansResultDto {
  deleted!: number;
  skipped!: number;
}
