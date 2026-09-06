import type { AdminUserLibraryStatsDto } from "@loomkeep/shared";

export class AdminUserLibraryStatsResponseDto implements AdminUserLibraryStatsDto {
  movies!: number;
  series!: number;
  anime!: number;
  games!: number;
  books!: number;
  total!: number;
}
