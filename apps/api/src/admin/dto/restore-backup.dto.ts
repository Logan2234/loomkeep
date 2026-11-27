import type { AdminBackupRestoreRequestDto } from "@loomkeep/shared/contracts";
import { IsString, MinLength } from "class-validator";

export class RestoreBackupDto implements AdminBackupRestoreRequestDto {
  @IsString()
  @MinLength(1)
  sql!: string;
}
