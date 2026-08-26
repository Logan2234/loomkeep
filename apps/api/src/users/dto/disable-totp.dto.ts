import type { DisableTotpRequestDto } from "@loomkeep/shared";
import { IsString, MinLength } from "class-validator";

export class DisableTotpDto implements DisableTotpRequestDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
