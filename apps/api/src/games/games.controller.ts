import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  Domain,
  GameDetailDto,
  GameEntryDto,
  GameSearchResponseDto,
  GameSource,
} from "@loomkeep/shared";
import type { PagedResult } from "@loomkeep/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { toQueryArray } from "../common/query-array.util";
import { AgeGateService } from "../users/age-gate.service";
import { DomainGateService } from "../users/domain-gate.service";
import { filterAdultContent } from "../users/age.util";
import { GameItemService } from "./game-item.service";
import { GameLibraryService } from "./game-library.service";
import { AddGameReplayDto } from "./dto/add-game-replay.dto";
import { UpdateGameEntryDto } from "./dto/update-game-entry.dto";
import { UpsertGameEntryDto } from "./dto/upsert-game-entry.dto";

@Controller("games")
export class GamesController {
  constructor(
    private readonly gameItemService: GameItemService,
    private readonly gameLibraryService: GameLibraryService,
    private readonly ageGate: AgeGateService,
    private readonly domainGate: DomainGateService,
  ) {}

  /**
   * Live catalogue search (IGDB). Nothing is persisted. 18+ titles are stripped
   * unless the account opted in and is confirmed 18+.
   */
  @Get("search")
  async search(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
  ): Promise<GameSearchResponseDto> {
    const query = q?.trim();

    if (!query) {
      throw new BadRequestException("Query 'q' is required");
    }

    await this.domainGate.assertEnabled(user.sub, Domain.GAMES);

    const [results, allowAdult] = await Promise.all([
      this.gameItemService.providerFor().search(query),
      this.ageGate.allowsAdultContent(user.sub),
    ]);
    return { results: filterAdultContent(results, allowAdult) };
  }

  @Get()
  async listEntries(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
    @Query("favorite") favorite?: string,
    @Query("status") status?: string | string[],
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("page") page?: string,
  ): Promise<PagedResult<GameEntryDto>> {
    await this.domainGate.assertEnabled(user.sub, Domain.GAMES);
    return this.gameLibraryService.listEntries(user.sub, {
      q,
      favorite: favorite === "true",
      statuses: toQueryArray(status),
      sort,
      order: order === "asc" ? "asc" : "desc",
      page: page ? Number(page) : undefined,
    });
  }

  @Put()
  upsertEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertGameEntryDto,
  ): Promise<GameEntryDto> {
    return this.gameLibraryService.upsertEntry(user.sub, dto);
  }

  @Get("entries/:id")
  getEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<GameEntryDto> {
    return this.gameLibraryService.getEntry(user.sub, entryId);
  }

  @Patch("entries/:id")
  updateEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: UpdateGameEntryDto,
  ): Promise<GameEntryDto> {
    return this.gameLibraryService.updateEntry(user.sub, entryId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("entries/:id")
  async deleteEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<void> {
    await this.gameLibraryService.deleteEntry(user.sub, entryId);
  }

  /** Log a completed replay (a completion beyond the entry's first one). */
  @Post("entries/:id/replays")
  addReplay(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: AddGameReplayDto,
  ): Promise<GameEntryDto> {
    return this.gameLibraryService.addReplay(user.sub, entryId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("replays/:id")
  async deleteReplay(
    @CurrentUser() user: JwtPayload,
    @Param("id") replayId: string,
  ): Promise<void> {
    await this.gameLibraryService.deleteReplay(user.sub, replayId);
  }

  /** Game detail page: catalogue metadata + the user's library state. */
  @Get(":source/:sourceId")
  getGameDetail(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("sourceId") sourceId: string,
  ): Promise<GameDetailDto> {
    return this.gameLibraryService.getGameDetail(
      user.sub,
      parseGameSource(sourceParam),
      sourceId,
    );
  }
}

function parseGameSource(value: string): GameSource {
  return parseEnumParam(value, [GameSource.IGDB], "game source");
}
