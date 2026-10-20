import type { SavedViewDto } from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import {
  CreateSavedViewBody,
  SavedViewResponseDto,
  UpdateSavedViewBody,
} from "./dto/saved-view.dto";
import { SavedViewService } from "./saved-view.service";

@Controller("saved-views")
export class SavedViewController {
  constructor(private readonly views: SavedViewService) {}

  @Get()
  @ApiOkResponse({ type: SavedViewResponseDto, isArray: true })
  list(@CurrentUser() user: JwtPayload): Promise<SavedViewDto[]> {
    return this.views.list(user.sub);
  }

  @Post()
  @ApiCreatedResponse({ type: SavedViewResponseDto })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateSavedViewBody,
  ): Promise<SavedViewDto> {
    return this.views.create(user.sub, body);
  }

  @Patch(":id")
  @ApiOkResponse({ type: SavedViewResponseDto })
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: UpdateSavedViewBody,
  ): Promise<SavedViewDto> {
    return this.views.update(user.sub, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.views.remove(user.sub, id);
  }
}
