import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import type {
  ListDetailDto,
  ListDto,
  ListItemDto,
  ListItemTargetType,
  ListMemberDto,
  ListMembershipDto,
  MyListDto,
} from "@loomkeep/shared";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { SocialFeatureGuard } from "../social/social-feature.guard";
import { AddListItemBody } from "./dto/add-list-item.dto";
import { AddListMemberBody } from "./dto/add-list-member.dto";
import { CreateListBody } from "./dto/create-list.dto";
import { ReorderListItemsBody } from "./dto/reorder-list-items.dto";
import { UpdateListBody } from "./dto/update-list.dto";
import { ListService } from "./list.service";

const LIST_ITEM_TARGET_TYPES: string[] = ["MEDIA", "GAME", "BOOK", "MUSIC"];

@Controller("lists")
export class ListController {
  constructor(private readonly lists: ListService) {}

  // --- Own lists: NOT social-gated (managing your own lists always works). ---

  @Get("me")
  listMine(@CurrentUser() user: JwtPayload): Promise<MyListDto[]> {
    return this.lists.listMine(user.sub);
  }

  // Owned + editor lists — feeds "Ajouter à une liste" on a work's page, so an
  // editor can add to a shared list, not just their own.
  @Get("editable")
  listEditable(@CurrentUser() user: JwtPayload): Promise<MyListDto[]> {
    return this.lists.listEditable(user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateListBody,
  ): Promise<ListDto> {
    return this.lists.create(user.sub, body);
  }

  @Get("me/membership")
  membershipFor(
    @CurrentUser() user: JwtPayload,
    @Query("targetType") targetType: string,
    @Query("targetId") targetId: string,
  ): Promise<ListMembershipDto> {
    if (!LIST_ITEM_TARGET_TYPES.includes(targetType) || !targetId) {
      throw new BadRequestException("Unknown or missing target");
    }

    return this.lists.membershipFor(
      user.sub,
      targetType as ListItemTargetType,
      targetId,
    );
  }

  // Owner or editor (ListMember) — "me" as in "a list I can edit", not
  // strictly "a list I own".
  @Get("me/:id")
  getMine(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<ListDetailDto> {
    return this.lists.getEditable(user.sub, id);
  }

  @Put(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: UpdateListBody,
  ): Promise<ListDto> {
    return this.lists.update(user.sub, id, body);
  }

  @Delete(":id")
  remove(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.lists.remove(user.sub, id);
  }

  @Post(":id/items")
  addItem(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: AddListItemBody,
  ): Promise<ListItemDto> {
    return this.lists.addItem(user.sub, id, body);
  }

  @Delete(":id/items/:itemId")
  removeItem(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
  ): Promise<void> {
    return this.lists.removeItem(user.sub, id, itemId);
  }

  @Put(":id/items/order")
  reorder(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: ReorderListItemsBody,
  ): Promise<void> {
    return this.lists.reorder(
      user.sub,
      id,
      body.orderedItemIds,
      body.expectedUpdatedAt,
    );
  }

  // --- Collaborators: social-gated (granting/revoking edit access to
  // another user is itself a social feature). Listing/adding are owner-only;
  // removing is owner-only except an editor can remove themselves (leave). ---

  @Get(":id/members")
  @UseGuards(SocialFeatureGuard)
  listMembers(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<ListMemberDto[]> {
    return this.lists.listMembers(user.sub, id);
  }

  @Post(":id/members")
  @UseGuards(SocialFeatureGuard)
  addMember(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: AddListMemberBody,
  ): Promise<ListMemberDto> {
    return this.lists.addMember(user.sub, id, body.username);
  }

  @Delete(":id/members/:memberUserId")
  @UseGuards(SocialFeatureGuard)
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("memberUserId") memberUserId: string,
  ): Promise<void> {
    return this.lists.removeMember(user.sub, id, memberUserId);
  }

  // --- A list of a viewer's choosing: social-gated + visibility-filtered. ---

  @Get("user/:username")
  @UseGuards(SocialFeatureGuard)
  listForUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<MyListDto[]> {
    return this.lists.listForUser(user.sub, username);
  }

  @Get(":id")
  @UseGuards(SocialFeatureGuard)
  async getForViewer(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<ListDetailDto> {
    const list = await this.lists.getForViewer(user.sub, id);
    if (!list) throw new NotFoundException();
    return list;
  }
}
