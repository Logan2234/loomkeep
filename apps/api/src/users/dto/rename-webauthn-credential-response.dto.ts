import type { RenameWebauthnCredentialResponseDto } from "@loomkeep/shared/contracts";
import { WebauthnCredentialResponseDto } from "./webauthn-credential-response.dto";

export class RenameWebauthnCredentialResultDto implements RenameWebauthnCredentialResponseDto {
  credential!: WebauthnCredentialResponseDto;
}
