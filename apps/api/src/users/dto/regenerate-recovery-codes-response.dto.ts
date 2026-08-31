import type { RegenerateRecoveryCodesResponseDto } from "@loomkeep/shared";

export class RegenerateRecoveryCodesResultDto implements RegenerateRecoveryCodesResponseDto {
  codes!: string[];
}
