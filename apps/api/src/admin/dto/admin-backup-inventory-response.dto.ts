import type {
  AdminBackupInventoryDto,
  AdminOrphanBackupFileDto,
} from "@loomkeep/shared";
import { AdminBackupFileResponseDto } from "./admin-backup-file-response.dto";

class AdminOrphanBackupFileResponseDto implements AdminOrphanBackupFileDto {
  filename!: string;
  sizeBytes!: number;
  createdAt!: string;
}

export class AdminBackupInventoryResponseDto implements AdminBackupInventoryDto {
  files!: AdminBackupFileResponseDto[];
  orphans!: AdminOrphanBackupFileResponseDto[];
}
