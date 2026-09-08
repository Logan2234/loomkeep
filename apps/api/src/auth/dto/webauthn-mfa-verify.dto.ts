import type { WebauthnMfaVerifyRequestDto } from "@loomkeep/shared";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { IsObject, IsString, MinLength } from "class-validator";

// `response` is the raw JSON produced by @simplewebauthn/browser's
// startAuthentication() — its exact shape is validated cryptographically by
// @simplewebauthn/server's verifyAuthenticationResponse(), so it isn't
// re-declared field-by-field here.
export class WebauthnMfaVerifyDto implements WebauthnMfaVerifyRequestDto {
  @IsString()
  @MinLength(1)
  webauthnChallengeId!: string;

  @IsObject()
  response!: AuthenticationResponseJSON;
}
