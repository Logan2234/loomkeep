import { IsString, MinLength } from "class-validator";
import type { DisableTotpRequestDto } from "@loomkeep/shared";

export class DisableTotpDto implements DisableTotpRequestDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
