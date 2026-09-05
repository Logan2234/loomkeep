import type { AchievementDto, PendingAchievementDto } from "@loomkeep/shared";
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import {
  CurrentUser,
  type JwtPayload,
} from "../../auth/decorators/current-user.decorator";
import { AchievementService } from "./achievement.service";
import { AchievementResponseDto } from "./dto/achievement-response.dto";
import { PendingAchievementResponseDto } from "./dto/pending-achievement-response.dto";

@Controller("achievements")
export class AchievementsController {
  constructor(private readonly achievements: AchievementService) {}

  /** The whole catalogue, projected for the current user — the [G5] screen. */
  @Get()
  @ApiOkResponse({ type: AchievementResponseDto, isArray: true })
  list(@CurrentUser() user: JwtPayload): Promise<AchievementDto[]> {
    return this.achievements.list(user.sub);
  }

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

  /** "curious_cat" signal — see AchievementService.markVersionLinkClicked. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("signals/version-link")
  async signalVersionLinkClicked(
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.achievements.markVersionLinkClicked(user.sub);
  }

  /** [G9] Adds `key` to the viewer's badge showcase. Returns the new set. */
  @Post(":key/equip")
  equip(
    @CurrentUser() user: JwtPayload,
    @Param("key") key: string,
  ): Promise<string[]> {
    return this.achievements.equip(user.sub, key);
  }

  /** [G9] Removes `key` from the viewer's badge showcase. Returns the new set. */
  @Delete(":key/equip")
  unequip(
    @CurrentUser() user: JwtPayload,
    @Param("key") key: string,
  ): Promise<string[]> {
    return this.achievements.unequip(user.sub, key);
  }
}
