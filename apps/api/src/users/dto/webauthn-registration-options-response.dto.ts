import type { WebauthnRegistrationOptionsDto } from "@loomkeep/shared";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";

export class WebauthnRegistrationOptionsResponseDto implements WebauthnRegistrationOptionsDto {
  webauthnChallengeId!: string;
  options!: PublicKeyCredentialCreationOptionsJSON;
}
