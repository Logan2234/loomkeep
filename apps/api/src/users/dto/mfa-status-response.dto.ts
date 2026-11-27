import type { MfaStatusDto } from "@loomkeep/shared/contracts";
import { WebauthnCredentialResponseDto } from "./webauthn-credential-response.dto";

export class MfaStatusResponseDto implements MfaStatusDto {
  totpEnabled!: boolean;
  emailEnabled!: boolean;
  recoveryCodesRemaining!: number;
  webauthnCredentials!: WebauthnCredentialResponseDto[];
  passwordlessEnabled!: boolean;
}
