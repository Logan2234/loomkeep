import type { AdminBackupFileContentDto } from "@loomkeep/shared/contracts";

export class AdminBackupFileContentResponseDto implements AdminBackupFileContentDto {
  filename!: string;
  content!: string;
}
