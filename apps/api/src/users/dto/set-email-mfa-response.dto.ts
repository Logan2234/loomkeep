import type { SetEmailMfaResponseDto } from "@loomkeep/shared/contracts";

export class SetEmailMfaResultDto implements SetEmailMfaResponseDto {
  recoveryCodes?: string[];
}
