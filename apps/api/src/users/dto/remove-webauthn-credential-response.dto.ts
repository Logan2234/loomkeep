import type { RemoveWebauthnCredentialResponseDto } from "@loomkeep/shared/contracts";

export class RemoveWebauthnCredentialResultDto implements RemoveWebauthnCredentialResponseDto {
  passwordlessDisabled!: boolean;
}
