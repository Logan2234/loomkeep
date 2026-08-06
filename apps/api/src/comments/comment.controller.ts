import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  type CommentCountDto,
  type CommentDto,
  type CommentPageDto,
  CommentTargetType,
  type CommentTargetType as CommentTargetTypeT,
} from "@loomkeep/shared";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { ReportService } from "../reports/report.service";
import { CreateReportBody } from "../reports/dto/create-report.dto";
import { SocialFeatureGuard } from "../social/social-feature.guard";
import { CommentService } from "./comment.service";
import { CreateCommentBody } from "./dto/create-comment.dto";
import { ReactCommentBody } from "./dto/react-comment.dto";
import { UpdateCommentBody } from "./dto/update-comment.dto";

function parseTarget(type: string): CommentTargetTypeT {
  if (!(Object.values(CommentTargetType) as string[]).includes(type)) {
    throw new BadRequestException("Unknown comment target type");
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
  count(
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<CommentCountDto> {
    return this.comments
      .count(parseTarget(type), id)
      .then((count) => ({ count }));
  }

  @Get(":type/:id")
  list(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
    @Query("cursor") cursor?: string,
  ): Promise<CommentPageDto> {
    return this.comments.list(user.sub, parseTarget(type), id, cursor);
  }

  // Anti-flood: comments (unlike reviews) have no per-target cap, so without a
  // per-user throttle a single person could post unbounded top-level comments
  // and replies back-to-back.
  @Throttle({ default: { limit: 1, ttl: 5_000 } })
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateCommentBody,
  ): Promise<CommentDto> {
    return this.comments.create(user.sub, body);
  }

  @Put(":id")
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
