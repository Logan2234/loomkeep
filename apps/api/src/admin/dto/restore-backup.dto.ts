import { IsString, MinLength } from "class-validator";
import type { AdminBackupRestoreRequestDto } from "@loomkeep/shared";

export class RestoreBackupDto implements AdminBackupRestoreRequestDto {
  @IsString()
  @MinLength(1)
  sql!: string;
}
