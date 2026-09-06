import type { SetEmailMfaRequestDto } from "@loomkeep/shared";
import { IsBoolean, IsString, MinLength } from "class-validator";

export class SetEmailMfaDto implements SetEmailMfaRequestDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
