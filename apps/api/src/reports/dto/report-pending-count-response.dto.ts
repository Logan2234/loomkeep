import type { ReportPendingCountDto } from "@loomkeep/shared";

export class ReportPendingCountResponseDto implements ReportPendingCountDto {
  count!: number;
}
