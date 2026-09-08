import type { WebauthnRegistrationVerifyRequestDto } from "@loomkeep/shared";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { IsObject, IsString, MinLength } from "class-validator";

// `response` is the raw JSON produced by @simplewebauthn/browser's
// startRegistration() — validated cryptographically by
// @simplewebauthn/server's verifyRegistrationResponse().
export class WebauthnRegistrationVerifyDto implements WebauthnRegistrationVerifyRequestDto {
  @IsString()
  @MinLength(1)
  webauthnChallengeId!: string;

  @IsObject()
  response!: RegistrationResponseJSON;

  @IsString()
  @MinLength(1)
  name!: string;
}
