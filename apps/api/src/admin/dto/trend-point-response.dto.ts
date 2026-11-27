import type { TrendPointDto } from "@loomkeep/shared/contracts";

export class TrendPointResponseDto implements TrendPointDto {
  periodStart!: string;
  count!: number;
}
