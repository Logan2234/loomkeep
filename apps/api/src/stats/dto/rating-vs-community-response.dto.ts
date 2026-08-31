import type { RatingVsCommunityDto } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

type SufficientRatingVsCommunity = Extract<
  RatingVsCommunityDto,
  { sufficientData: true }
>;
type InsufficientRatingVsCommunity = Extract<
  RatingVsCommunityDto,
  { sufficientData: false }
>;

export class SufficientRatingVsCommunityResponseDto implements SufficientRatingVsCommunity {
  @ApiProperty({ enum: [true] })
  sufficientData!: true;

  yourAverage!: number;
  communityAverage!: number;
  sampleSize!: number;
}

export class InsufficientRatingVsCommunityResponseDto implements InsufficientRatingVsCommunity {
  @ApiProperty({ enum: [false] })
  sufficientData!: false;

  sampleSize!: number;
}
