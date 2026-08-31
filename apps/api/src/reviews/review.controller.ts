import {
  ErrorCode,
  type MyReviewDto,
  type ReviewBatchResultDto,
  type ReviewDto,
  type ReviewRevisionDto,
  ReviewTargetType,
  type ReviewUnvoteResultDto,
  type ReviewVoteResultDto,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { SocialFeatureGuard } from "../social/social-feature.guard";
import {
  BatchDeleteReviewsBody,
  BatchVisibilityBody,
} from "./dto/batch-reviews.dto";
import { MyReviewResponseDto } from "./dto/my-review-response.dto";
import { ReviewBatchResultResponseDto } from "./dto/review-batch-result-response.dto";
import { ReviewResponseDto } from "./dto/review-response.dto";
import { ReviewRevisionResponseDto } from "./dto/review-revision-response.dto";
import { ReviewUnvoteResultResponseDto } from "./dto/review-unvote-result-response.dto";
import { ReviewVoteResultResponseDto } from "./dto/review-vote-result-response.dto";
import { UpsertReviewBody } from "./dto/upsert-review.dto";
import { VoteReviewBody } from "./dto/vote-review.dto";
import { ReviewService } from "./review.service";

function parseTarget(type: string): ReviewTargetType {
  if (!(Object.values(ReviewTargetType) as string[]).includes(type)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ReviewUnknownTargetType,
      undefined,
      "Unknown review target type",
    );
  }

  return type as ReviewTargetType;
}

@Controller("reviews")
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  // --- Own reviews: NOT social-gated (rating your own items always works). ---

  @Get("me")
  @ApiOkResponse({ type: MyReviewResponseDto, isArray: true })
  listMine(@CurrentUser() user: JwtPayload): Promise<MyReviewDto[]> {
    return this.reviews.listMine(user.sub);
  }

  @Post("me/batch/delete")
  @ApiCreatedResponse({ type: ReviewBatchResultResponseDto })
  async removeMany(
    @CurrentUser() user: JwtPayload,
    @Body() body: BatchDeleteReviewsBody,
  ): Promise<ReviewBatchResultDto> {
    return { count: await this.reviews.removeMany(user.sub, body.ids) };
  }

  @Post("me/batch/visibility")
  @ApiCreatedResponse({ type: ReviewBatchResultResponseDto })
  async setVisibilityMany(
    @CurrentUser() user: JwtPayload,
    @Body() body: BatchVisibilityBody,
  ): Promise<ReviewBatchResultDto> {
    return {
      count: await this.reviews.setVisibilityMany(
        user.sub,
        body.ids,
        body.visibility,
      ),
    };
  }

  @Get("me/:type/:id")
  @ApiOkResponse({ type: ReviewResponseDto, nullable: true })
  getMine(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<ReviewDto | null> {
    return this.reviews.getMine(user.sub, parseTarget(type), id);
  }

  @Put("me/:type/:id")
  @ApiOkResponse({ type: ReviewResponseDto })
  upsert(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() body: UpsertReviewBody,
  ): Promise<ReviewDto> {
    return this.reviews.upsert(user.sub, parseTarget(type), id, body);
  }

  @Delete("me/:type/:id")
  remove(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.reviews.remove(user.sub, parseTarget(type), id);
  }

  @Get("me/:type/:id/revisions")
  @ApiOkResponse({ type: ReviewRevisionResponseDto, isArray: true })
  revisions(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<ReviewRevisionDto[]> {
    return this.reviews.revisions(user.sub, parseTarget(type), id);
  }

  // --- Others' reviews for a target: social-gated + visibility-filtered. ---

  @Get(":type/:id")
  @UseGuards(SocialFeatureGuard)
  @ApiOkResponse({ type: ReviewResponseDto, isArray: true })
  listForTarget(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<ReviewDto[]> {
    return this.reviews.listForTarget(user.sub, parseTarget(type), id);
  }

  // --- Voting on someone else's review: social-gated, a community action. ---

  @Put(":reviewId/vote")
  @UseGuards(SocialFeatureGuard)
  @ApiOkResponse({ type: ReviewVoteResultResponseDto })
  vote(
    @CurrentUser() user: JwtPayload,
    @Param("reviewId") reviewId: string,
    @Body() body: VoteReviewBody,
  ): Promise<ReviewVoteResultDto> {
    return this.reviews.vote(user.sub, reviewId, body.value);
  }

  @Delete(":reviewId/vote")
  @UseGuards(SocialFeatureGuard)
  @ApiOkResponse({ type: ReviewUnvoteResultResponseDto })
  unvote(
    @CurrentUser() user: JwtPayload,
    @Param("reviewId") reviewId: string,
  ): Promise<ReviewUnvoteResultDto> {
    return this.reviews.unvote(user.sub, reviewId);
  }
}
