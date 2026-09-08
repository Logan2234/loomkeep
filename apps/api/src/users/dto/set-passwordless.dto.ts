import type { SetPasswordlessRequestDto } from "@loomkeep/shared";
import { IsBoolean, IsString, MinLength } from "class-validator";

export class SetPasswordlessDto implements SetPasswordlessRequestDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
