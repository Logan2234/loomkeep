import type { ReportPendingCountDto } from "@loomkeep/shared/contracts";

export class ReportPendingCountResponseDto implements ReportPendingCountDto {
  count!: number;
}
