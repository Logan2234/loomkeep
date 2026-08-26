import { IsString, MinLength } from "class-validator";
import type { ResendMfaEmailCodeRequestDto } from "@loomkeep/shared";

export class ResendMfaEmailCodeDto implements ResendMfaEmailCodeRequestDto {
  @IsString()
  @MinLength(1)
  challengeId!: string;
}
