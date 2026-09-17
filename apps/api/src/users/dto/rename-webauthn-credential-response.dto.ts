import type { RenameWebauthnCredentialResponseDto } from "@loomkeep/shared";
import { WebauthnCredentialResponseDto } from "./webauthn-credential-response.dto";

export class RenameWebauthnCredentialResultDto implements RenameWebauthnCredentialResponseDto {
  credential!: WebauthnCredentialResponseDto;
}
