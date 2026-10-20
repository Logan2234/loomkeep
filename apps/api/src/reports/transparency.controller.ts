import type { ModerationTransparencyDto } from "@loomkeep/shared";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { SocialFeatureGuard } from "../social/social-feature.guard";
import { ModerationTransparencyResponseDto } from "./dto/moderation-transparency-response.dto";
import { TransparencyQueryDto } from "./dto/transparency-query.dto";
import { TransparencyService } from "./transparency.service";

/**
 * Figures behind the public /legal/transparency page. Social-gated: without
 * comments, reviews or lists there is nothing to report or moderate.
 */
@Public()
@UseGuards(SocialFeatureGuard)
@Controller("transparency")
export class TransparencyController {
  constructor(private readonly transparency: TransparencyService) {}

  @Get()
  @ApiOkResponse({ type: ModerationTransparencyResponseDto })
  get(
    @Query() query: TransparencyQueryDto,
  ): Promise<ModerationTransparencyDto> {
    return this.transparency.forYear(query.year);
  }
}
