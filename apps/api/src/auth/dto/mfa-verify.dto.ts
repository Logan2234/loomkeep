import { IsString, MinLength } from "class-validator";
import type { MfaVerifyRequestDto } from "@loomkeep/shared";

export class MfaVerifyDto implements MfaVerifyRequestDto {
  @IsString()
  @MinLength(1)
  challengeId!: string;

  // 6-digit TOTP/email code or a 10-char recovery code (possibly dashed) — no fixed length here.
  @IsString()
  @MinLength(1)
  code!: string;
}
