import { ErrorCode } from "@loomkeep/shared/catalog";
import { type ListItemDto } from "@loomkeep/shared/contracts";
import { Domain } from "@loomkeep/shared/enums";
import { Body, Controller, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse } from "@nestjs/swagger";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { WorkPageService } from "../links/work-page.service";
import { AgeGateService } from "../users/age-gate.service";
import { DomainGateService } from "../users/domain-gate.service";
import { AddListWorkBody } from "./dto/add-list-work.dto";
import { ListItemResponseDto } from "./dto/list-item-response.dto";
import { ListService } from "./list.service";

const DOMAIN_OF = {
  MEDIA: Domain.MEDIA,
  GAME: Domain.GAMES,
  BOOK: Domain.BOOKS,
  MUSIC: Domain.MUSIC,
} as const;

// Its own controller: the catalogue modules import ListsModule, so
// ListService can't reach back to them for the cache.
@Controller("lists")
export class ListWorksController {
  constructor(
    private readonly lists: ListService,
    private readonly pages: WorkPageService,
    private readonly ageGate: AgeGateService,
    private readonly domainGate: DomainGateService,
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

    // An 18+ work answers like a missing one for an account that can't see
    // it, as search and chat cards hide it.
    if (
      !work ||
      (work.isAdult && !(await this.ageGate.allowsAdultContent(user.sub)))
    ) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ListWorkNotFound);
    }

    await this.domainGate.assertEnabled(user.sub, DOMAIN_OF[work.targetType]);

    return this.lists.addItem(user.sub, id, {
      targetType: work.targetType,
      targetId: work.targetId,
    });
  }
}
