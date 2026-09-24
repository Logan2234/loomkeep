import type { EeStatusDto } from "@loomkeep/shared";

export class EeStatusResponseDto implements EeStatusDto {
  active!: boolean;
}
