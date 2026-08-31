import type { AdminCacheListResponseDto } from "@loomkeep/shared";
import { AdminCacheItemResponseDto } from "./admin-cache-item-response.dto";

export class AdminCacheListResultResponseDto implements AdminCacheListResponseDto {
  items!: AdminCacheItemResponseDto[];
  hasMore!: boolean;
  total?: number;
  staleTotal!: number;
  orphanTotal!: number;
}
