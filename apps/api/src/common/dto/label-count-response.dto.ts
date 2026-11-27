import type { LabelCountDto } from "@loomkeep/shared/contracts";

export class LabelCountResponseDto implements LabelCountDto {
  label!: string;
  count!: number;
}
