import { ErrorCode, type ListItemDto } from "@loomkeep/shared";
import { Body, Controller, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse } from "@nestjs/swagger";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { WorkPageService } from "../links/work-page.service";
import { AddListWorkBody } from "./dto/add-list-work.dto";
import { ListItemResponseDto } from "./dto/list-item-response.dto";
import { ListService } from "./list.service";

// Its own controller: the catalogue modules import ListsModule, so
// ListService can't reach back to them for the cache.
@Controller("lists")
export class ListWorksController {
  constructor(
    private readonly lists: ListService,
    private readonly pages: WorkPageService,
  ) {}

  /** A work found by search, added without the viewer tracking it. */
  @Post(":id/works")
  @ApiCreatedResponse({ type: ListItemResponseDto })
  async addWork(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: AddListWorkBody,
  ): Promise<ListItemDto> {
    const work = await this.pages.cache(body.work).catch(() => null);

    if (!work) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ListWorkNotFound);
    }

    return this.lists.addItem(user.sub, id, {
      targetType: work.targetType,
      targetId: work.targetId,
    });
  }
}
