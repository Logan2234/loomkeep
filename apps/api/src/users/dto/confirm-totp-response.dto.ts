import type { ConfirmTotpResponseDto } from "@loomkeep/shared";

export class ConfirmTotpResultDto implements ConfirmTotpResponseDto {
  recoveryCodes?: string[];
}
