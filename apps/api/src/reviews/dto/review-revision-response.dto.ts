import type { ReviewRevisionDto } from "@loomkeep/shared/contracts";

export class ReviewRevisionResponseDto implements ReviewRevisionDto {
  rating!: number;
  text!: string | null;
  createdAt!: string;
}
