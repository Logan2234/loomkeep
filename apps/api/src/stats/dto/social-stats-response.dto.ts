import type {
  MonthCountDto,
  RatingVsCommunityDto,
  SocialStatsDto,
} from "@loomkeep/shared";
import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import {
  InsufficientRatingVsCommunityResponseDto,
  SufficientRatingVsCommunityResponseDto,
} from "./rating-vs-community-response.dto";

class MonthCountResponseDto implements MonthCountDto {
  month!: string;
  count!: number;
}

@ApiExtraModels(
  SufficientRatingVsCommunityResponseDto,
  InsufficientRatingVsCommunityResponseDto,
)
export class SocialStatsResponseDto implements SocialStatsDto {
  reviewsWritten!: number;
  avgReviewLength!: number | null;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(SufficientRatingVsCommunityResponseDto) },
      { $ref: getSchemaPath(InsufficientRatingVsCommunityResponseDto) },
    ],
  })
  ratingVsCommunity!: RatingVsCommunityDto;

  commentsWritten!: number;
  rootCommentsCount!: number;
  replyCommentsCount!: number;
  spoilerCommentRatio!: number;
  reviewRevisionsCount!: number;
  helpfulVotesReceived!: number;
  mostVotedReviewVotes!: number | null;
  reactionsGiven!: number;
  reactionsReceived!: number;
  listsWritten!: number;
  listsPublicCount!: number;
  newFollowersByMonth!: MonthCountResponseDto[];
  followerReciprocityRate!: number;
  socialActivityByMonth!: MonthCountResponseDto[];
  contributionStreakDays!: number;
}
