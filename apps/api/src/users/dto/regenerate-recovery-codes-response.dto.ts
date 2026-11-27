import type { RegenerateRecoveryCodesResponseDto } from "@loomkeep/shared/contracts";

export class RegenerateRecoveryCodesResultDto implements RegenerateRecoveryCodesResponseDto {
  codes!: string[];
}
