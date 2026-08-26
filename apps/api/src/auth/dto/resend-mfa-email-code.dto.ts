import type { ResendMfaEmailCodeRequestDto } from "@loomkeep/shared";
import { IsString, MinLength } from "class-validator";

export class ResendMfaEmailCodeDto implements ResendMfaEmailCodeRequestDto {
  @IsString()
  @MinLength(1)
  challengeId!: string;
}
