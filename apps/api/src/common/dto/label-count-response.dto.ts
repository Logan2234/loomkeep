import type { LabelCountDto } from "@loomkeep/shared";

export class LabelCountResponseDto implements LabelCountDto {
  label!: string;
  count!: number;
}
