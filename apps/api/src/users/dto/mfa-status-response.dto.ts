import type { MfaStatusDto } from "@loomkeep/shared";

export class MfaStatusResponseDto implements MfaStatusDto {
  totpEnabled!: boolean;
  emailEnabled!: boolean;
  recoveryCodesRemaining!: number;
}
