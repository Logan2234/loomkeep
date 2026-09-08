import type { RemoveWebauthnCredentialResponseDto } from "@loomkeep/shared";

export class RemoveWebauthnCredentialResultDto implements RemoveWebauthnCredentialResponseDto {
  passwordlessDisabled!: boolean;
}
