import type { SetEmailMfaResponseDto } from "@loomkeep/shared";

export class SetEmailMfaResultDto implements SetEmailMfaResponseDto {
  recoveryCodes?: string[];
}
