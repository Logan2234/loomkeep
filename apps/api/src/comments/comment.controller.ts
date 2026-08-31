import {
  type CommentCountDto,
  type CommentDto,
  CommentTargetType,
  type CommentTargetType as CommentTargetTypeT,
  ErrorCode,
  type PagedResult,
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
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { parsePageQuery } from "../common/pagination.util";
import { CreateReportBody } from "../reports/dto/create-report.dto";
import { ReportService } from "../reports/report.service";
import { SocialFeatureGuard } from "../social/social-feature.guard";
import { COMMENT_PAGE_SIZE, CommentService } from "./comment.service";
import { CommentCountResponseDto } from "./dto/comment-count-response.dto";
import { CommentResponseDto } from "./dto/comment-response.dto";
import { CreateCommentBody } from "./dto/create-comment.dto";
import { ReactCommentBody } from "./dto/react-comment.dto";
import { UpdateCommentBody } from "./dto/update-comment.dto";

function parseTarget(type: string): CommentTargetTypeT {
  if (!(Object.values(CommentTargetType) as string[]).includes(type)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.CommentUnknownTargetType,
    );
  }

  return type as CommentTargetTypeT;
}

// Comments only make sense between people, so — unlike reviews — there is no
// self-host-safe "keep it local" fallback: the whole controller gates behind
// SOCIAL_ENABLED (404 when off).
@UseGuards(SocialFeatureGuard)
@Controller("comments")
export class CommentController {
  constructor(
    private readonly comments: CommentService,
    private readonly reports: ReportService,
  ) {}

  @Get(":type/:id/count")
  @ApiOkResponse({ type: CommentCountResponseDto })
  count(
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<CommentCountDto> {
    return this.comments
      .count(parseTarget(type), id)
      .then((count) => ({ count }));
  }

  @Get(":type/:id")
  @ApiOkResponse({ type: PagedResponseDto(CommentResponseDto) })
  list(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<CommentDto>> {
    const parsed = parsePageQuery(page, limit, COMMENT_PAGE_SIZE);
    return this.comments.list(
      user.sub,
      parseTarget(type),
      id,
      parsed.page,
      parsed.limit,
    );
  }

  // Anti-flood: comments (unlike reviews) have no per-target cap, so without a
  // per-user throttle a single person could post unbounded top-level comments
  // and replies back-to-back.
  @Throttle({ default: { limit: 1, ttl: 5_000 } })
  @Post()
  @ApiCreatedResponse({ type: CommentResponseDto })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateCommentBody,
  ): Promise<CommentDto> {
    return this.comments.create(user.sub, body);
  }

  @Put(":id")
  @ApiOkResponse({ type: CommentResponseDto })
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: UpdateCommentBody,
  ): Promise<CommentDto> {
    return this.comments.update(user.sub, id, body);
  }

  @Delete(":id")
  remove(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.comments.remove(user.sub, id);
  }

  @Post(":id/react")
  react(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: ReactCommentBody,
  ): Promise<void> {
    return this.comments.react(user.sub, id, body.emote);
  }

  @Delete(":id/react")
  unreact(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.comments.unreact(user.sub, id);
  }

  @Post(":id/report")
  report(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: CreateReportBody,
  ): Promise<void> {
    return this.reports.create(
      user.sub,
      "COMMENT",
      id,
      body.category,
      body.motif,
      body.reason,
    );
  }
}
