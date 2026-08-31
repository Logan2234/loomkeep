import type { AdminBackupFileDto } from "@loomkeep/shared";

export class AdminBackupFileResponseDto implements AdminBackupFileDto {
  id!: string;
  filename!: string;
  sizeBytes!: number;
  createdAt!: string;
}
