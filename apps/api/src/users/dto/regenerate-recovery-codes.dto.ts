import type { RegenerateRecoveryCodesRequestDto } from "@loomkeep/shared";
import { IsString, MinLength } from "class-validator";

export class RegenerateRecoveryCodesDto implements RegenerateRecoveryCodesRequestDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
