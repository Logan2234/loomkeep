import type { WebauthnMfaOptionsResponseDto } from "@loomkeep/shared";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";

export class WebauthnMfaOptionsResultDto implements WebauthnMfaOptionsResponseDto {
  webauthnChallengeId!: string;
  options!: PublicKeyCredentialRequestOptionsJSON;
}
