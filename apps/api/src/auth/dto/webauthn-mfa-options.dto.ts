import type { WebauthnMfaOptionsRequestDto } from "@loomkeep/shared";
import { IsString, MinLength } from "class-validator";

export class WebauthnMfaOptionsDto implements WebauthnMfaOptionsRequestDto {
  @IsString()
  @MinLength(1)
  challengeId!: string;
}
