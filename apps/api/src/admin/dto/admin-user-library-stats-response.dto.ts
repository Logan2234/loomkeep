import type { AdminUserLibraryStatsDto } from "@loomkeep/shared/contracts";

export class AdminUserLibraryStatsResponseDto implements AdminUserLibraryStatsDto {
  movies!: number;
  series!: number;
  anime!: number;
  games!: number;
  books!: number;
  music!: number;
  total!: number;
}
