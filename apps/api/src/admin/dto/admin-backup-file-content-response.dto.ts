import type { AdminBackupFileContentDto } from "@loomkeep/shared";

export class AdminBackupFileContentResponseDto implements AdminBackupFileContentDto {
  filename!: string;
  content!: string;
}
