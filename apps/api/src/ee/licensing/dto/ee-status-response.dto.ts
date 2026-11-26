import type { EeStatusDto } from "../ee-status.types";

export class EeStatusResponseDto implements EeStatusDto {
  active!: boolean;
}
