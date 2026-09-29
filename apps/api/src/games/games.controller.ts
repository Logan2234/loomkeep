import type {
  BulkEntriesResultDto,
  PagedResult,
  PileSummaryDto,
} from "@loomkeep/shared";
import {
  Domain,
  ErrorCode,
  GameDetailDto,
  GameEntryDto,
  GameSearchResponseDto,
  GameSessionMutationDto,
  GameSessionSummaryDto,
  GameSource,
} from "@loomkeep/shared";
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
  Put,
  Query,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import {
  BulkEntriesResultResponseDto,
  BulkEntriesTargetBody,
} from "../common/dto/bulk-entries.dto";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { safeLang } from "../common/locale.util";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { toQueryArray } from "../common/query-array.util";
import { PileSummaryResponseDto } from "../stats/dto/pile-summary-response.dto";
import { AgeGateService } from "../users/age-gate.service";
import { filterAdultContent } from "../users/age.util";
import { DomainGateService } from "../users/domain-gate.service";
import { BulkUpdateGameEntriesBody } from "./dto/bulk-update-game-entries.dto";
import { CreateGameSessionDto } from "./dto/create-game-session.dto";
import { GameDetailResponseDto } from "./dto/game-detail-response.dto";
import { GameEntryResponseDto } from "./dto/game-entry-response.dto";
import { GameSearchResultResponseDto } from "./dto/game-search-response.dto";
import {
  GameSessionMutationResponseDto,
  GameSessionSummaryResponseDto,
} from "./dto/game-session-response.dto";
import { UpdateGameEntryDto } from "./dto/update-game-entry.dto";
import { UpdateGameSessionDto } from "./dto/update-game-session.dto";
import { UpsertGameEntryDto } from "./dto/upsert-game-entry.dto";
import { GameItemService } from "./game-item.service";
import { GameLibraryService } from "./game-library.service";
import { GameSessionService } from "./game-session.service";

@Controller("games")
export class GamesController {
  constructor(
    private readonly gameItemService: GameItemService,
    private readonly gameLibraryService: GameLibraryService,
    private readonly gameSessionService: GameSessionService,
    private readonly ageGate: AgeGateService,
    private readonly domainGate: DomainGateService,
  ) {}

  /**
   * Live catalogue search (IGDB). Nothing is persisted. 18+ titles are stripped
   * unless the account opted in and is confirmed 18+.
   */
  @Get("search")
  @ApiOkResponse({ type: GameSearchResultResponseDto })
  async search(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
  ): Promise<GameSearchResponseDto> {
    const query = q?.trim();

    if (!query) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.CatalogSearchQueryRequired,
      );
    }

    await this.domainGate.assertEnabled(user.sub, Domain.GAMES);

    const [results, allowAdult] = await Promise.all([
      this.gameItemService.providerFor().search(query),
      this.ageGate.allowsAdultContent(user.sub),
    ]);
    return { results: filterAdultContent(results, allowAdult) };
  }

  @Get("entries/:id/sessions")
  @ApiOkResponse({ type: GameSessionSummaryResponseDto })
  listSessions(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Query("page") page?: string,
  ): Promise<GameSessionSummaryDto> {
    return this.gameSessionService.list(
      user.sub,
      entryId,
      page ? Number(page) : 1,
    );
  }

  @Post("entries/:id/sessions")
  @ApiCreatedResponse({ type: GameSessionMutationResponseDto })
  createSession(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: CreateGameSessionDto,
  ): Promise<GameSessionMutationDto> {
    return this.gameSessionService.create(user.sub, entryId, dto);
  }

  @Patch("sessions/:id")
  @ApiOkResponse({ type: GameSessionMutationResponseDto })
  updateSession(
    @CurrentUser() user: JwtPayload,
    @Param("id") sessionId: string,
    @Body() dto: UpdateGameSessionDto,
  ): Promise<GameSessionMutationDto> {
    return this.gameSessionService.update(user.sub, sessionId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("sessions/:id")
  async deleteSession(
    @CurrentUser() user: JwtPayload,
    @Param("id") sessionId: string,
  ): Promise<void> {
    await this.gameSessionService.delete(user.sub, sessionId);
  }

  @Get()
  @ApiOkResponse({ type: PagedResponseDto(GameEntryResponseDto) })
  async listEntries(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
    @Query("favorite") favorite?: string,
    @Query("status") status?: string | string[],
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("lang") lang?: string,
  ): Promise<PagedResult<GameEntryDto>> {
    await this.domainGate.assertEnabled(user.sub, Domain.GAMES);
    return this.gameLibraryService.listEntries(user.sub, {
      q,
      favorite: favorite === "true",
      statuses: toQueryArray(status),
      sort,
      order: order === "asc" ? "asc" : "desc",
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      lang: safeLang(lang),
    });
  }

  /** What's left in the pile among the entries the list shows under the same filters. */
  @Get("pile")
  @ApiOkResponse({ type: PileSummaryResponseDto })
  async getPile(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
    @Query("favorite") favorite?: string,
    @Query("status") status?: string | string[],
    @Query("lang") lang?: string,
  ): Promise<PileSummaryDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.GAMES);
    return this.gameLibraryService.getPile(user.sub, {
      q,
      favorite: favorite === "true",
      statuses: toQueryArray(status),
      lang: safeLang(lang),
    });
  }

  @Put()
  @ApiOkResponse({ type: GameEntryResponseDto })
  upsertEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertGameEntryDto,
  ): Promise<GameEntryDto> {
    return this.gameLibraryService.upsertEntry(user.sub, dto);
  }

  @Get("entries/:id")
  @ApiOkResponse({ type: GameEntryResponseDto })
  getEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<GameEntryDto> {
    return this.gameLibraryService.getEntry(user.sub, entryId);
  }

  @Patch("entries/:id")
  @ApiOkResponse({ type: GameEntryResponseDto })
  updateEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: UpdateGameEntryDto,
  ): Promise<GameEntryDto> {
    return this.gameLibraryService.updateEntry(user.sub, entryId, dto);
  }

  /** One change applied to many entries (UX-04), with a single update's side effects on each. */
  @HttpCode(HttpStatus.OK)
  @Post("entries/bulk")
  @ApiOkResponse({ type: BulkEntriesResultResponseDto })
  async bulkUpdate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkUpdateGameEntriesBody,
  ): Promise<BulkEntriesResultDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.GAMES);
    return this.gameLibraryService.bulkUpdate(user.sub, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("entries/bulk-delete")
  @ApiOkResponse({ type: BulkEntriesResultResponseDto })
  async bulkDelete(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkEntriesTargetBody,
  ): Promise<BulkEntriesResultDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.GAMES);
    return this.gameLibraryService.bulkDelete(user.sub, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("entries/:id")
  async deleteEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<void> {
    await this.gameLibraryService.deleteEntry(user.sub, entryId);
  }

  /** Game detail page: catalogue metadata + the user's library state. */
  @Get(":source/:sourceId")
  @ApiOkResponse({ type: GameDetailResponseDto })
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
