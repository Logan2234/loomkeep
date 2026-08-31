import type { TrendPointDto } from "@loomkeep/shared";

export class TrendPointResponseDto implements TrendPointDto {
  periodStart!: string;
  count!: number;
}
