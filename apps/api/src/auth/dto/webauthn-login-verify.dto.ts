import type { WebauthnLoginVerifyRequestDto } from "@loomkeep/shared";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { IsObject, IsString, MinLength } from "class-validator";

export class WebauthnLoginVerifyDto implements WebauthnLoginVerifyRequestDto {
  @IsString()
  @MinLength(1)
  webauthnChallengeId!: string;

  @IsObject()
  response!: AuthenticationResponseJSON;
}
