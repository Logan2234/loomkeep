import type { WebauthnRegistrationVerifyResponseDto } from "@loomkeep/shared/contracts";
import { WebauthnCredentialResponseDto } from "./webauthn-credential-response.dto";

export class WebauthnRegistrationVerifyResultDto implements WebauthnRegistrationVerifyResponseDto {
  credential!: WebauthnCredentialResponseDto;
  recoveryCodes?: string[];
}
