import type { WebauthnRegistrationVerifyResponseDto } from "@loomkeep/shared";
import { WebauthnCredentialResponseDto } from "./webauthn-credential-response.dto";

export class WebauthnRegistrationVerifyResultDto implements WebauthnRegistrationVerifyResponseDto {
  credential!: WebauthnCredentialResponseDto;
}
