import {
  type MyReviewDto,
  type ReviewDto,
  type ReviewRevisionDto,
  ReviewTargetType,
  type ReviewVoteValue,
} from "@loomkeep/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { SocialFeatureGuard } from "../social/social-feature.guard";
import {
  BatchDeleteReviewsBody,
  BatchVisibilityBody,
} from "./dto/batch-reviews.dto";
import { UpsertReviewBody } from "./dto/upsert-review.dto";
import { VoteReviewBody } from "./dto/vote-review.dto";
import { ReviewService } from "./review.service";

function parseTarget(type: string): ReviewTargetType {
  if (!(Object.values(ReviewTargetType) as string[]).includes(type)) {
    throw new BadRequestException("Unknown review target type");
  }

  return type as ReviewTargetType;
}

@Controller("reviews")
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  // --- Own reviews: NOT social-gated (rating your own items always works). ---

  @Get("me")
  listMine(@CurrentUser() user: JwtPayload): Promise<MyReviewDto[]> {
    return this.reviews.listMine(user.sub);
  }

  @Post("me/batch/delete")
  async removeMany(
    @CurrentUser() user: JwtPayload,
    @Body() body: BatchDeleteReviewsBody,
  ): Promise<{ count: number }> {
    return { count: await this.reviews.removeMany(user.sub, body.ids) };
  }

  @Post("me/batch/visibility")
  async setVisibilityMany(
    @CurrentUser() user: JwtPayload,
    @Body() body: BatchVisibilityBody,
  ): Promise<{ count: number }> {
    return {
      count: await this.reviews.setVisibilityMany(
        user.sub,
        body.ids,
        body.visibility,
      ),
    };
  }

  @Get("me/:type/:id")
  getMine(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<ReviewDto | null> {
    return this.reviews.getMine(user.sub, parseTarget(type), id);
  }

  @Put("me/:type/:id")
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
  vote(
    @CurrentUser() user: JwtPayload,
    @Param("reviewId") reviewId: string,
    @Body() body: VoteReviewBody,
  ): Promise<{ score: number; myVote: ReviewVoteValue }> {
    return this.reviews.vote(user.sub, reviewId, body.value);
  }

  @Delete(":reviewId/vote")
  @UseGuards(SocialFeatureGuard)
  unvote(
    @CurrentUser() user: JwtPayload,
    @Param("reviewId") reviewId: string,
  ): Promise<{ score: number }> {
    return this.reviews.unvote(user.sub, reviewId);
  }
}
