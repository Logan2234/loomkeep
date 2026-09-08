import type { WebauthnLoginOptionsResponseDto } from "@loomkeep/shared";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";

export class WebauthnLoginOptionsResultDto implements WebauthnLoginOptionsResponseDto {
  webauthnChallengeId!: string;
  options!: PublicKeyCredentialRequestOptionsJSON;
}
