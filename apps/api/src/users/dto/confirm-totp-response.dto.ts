import type { ConfirmTotpResponseDto } from "@loomkeep/shared/contracts";

export class ConfirmTotpResultDto implements ConfirmTotpResponseDto {
  recoveryCodes?: string[];
}
