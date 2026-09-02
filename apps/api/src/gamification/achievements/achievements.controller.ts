import type { PendingAchievementDto } from "@loomkeep/shared";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import {
  CurrentUser,
  type JwtPayload,
} from "../../auth/decorators/current-user.decorator";
import { AchievementService } from "./achievement.service";
import { PendingAchievementResponseDto } from "./dto/pending-achievement-response.dto";

@Controller("achievements")
export class AchievementsController {
  constructor(private readonly achievements: AchievementService) {}

  @Get("pending")
  @ApiOkResponse({ type: PendingAchievementResponseDto, isArray: true })
  pending(@CurrentUser() user: JwtPayload): Promise<PendingAchievementDto[]> {
    return this.achievements.pending(user.sub);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(":id/displayed")
  async markDisplayed(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    await this.achievements.markDisplayed(user.sub, id);
  }
}
