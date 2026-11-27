import { ErrorCode } from "@loomkeep/shared/catalog";
import type {
  BulkEntriesResultDto,
  PagedResult,
  PileSummaryDto,
} from "@loomkeep/shared/contracts";
import {
  MusicDetailDto,
  MusicEntryDto,
  MusicSearchResponseDto,
  StoredMusicDetailDto,
} from "@loomkeep/shared/contracts";
import { Domain, MusicSource } from "@loomkeep/shared/enums";
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
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { PileSummaryResponseDto } from "../stats/dto/pile-summary-response.dto";
import { DomainGated } from "../users/domain-gate.guard";
import {
  BulkEntriesResultResponseDto,
  BulkEntriesTargetBody,
} from "../work/dto/bulk-entries.dto";
import { parseListEntriesQuery } from "../work/entry-lifecycle.util";
import { BulkUpdateMusicEntriesBody } from "./dto/bulk-update-music-entries.dto";
import {
  MusicDetailResponseDto,
  StoredMusicDetailResponseDto,
} from "./dto/music-detail-response.dto";
import { MusicEntryResponseDto } from "./dto/music-entry-response.dto";
import { MusicSearchResultResponseDto } from "./dto/music-search-response.dto";
import { UpdateMusicEntryDto } from "./dto/update-music-entry.dto";
import { UpsertMusicEntryDto } from "./dto/upsert-music-entry.dto";
import { MusicItemService } from "./music-item.service";
import { MusicLibraryService } from "./music-library.service";

@DomainGated(Domain.MUSIC)
@Controller("music")
export class MusicController {
  constructor(
    private readonly musicItemService: MusicItemService,
    private readonly musicLibraryService: MusicLibraryService,
  ) {}

  /** Live catalogue search (MusicBrainz). */
  @Get("search")
  @ApiOkResponse({ type: MusicSearchResultResponseDto })
  async search(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
  ): Promise<MusicSearchResponseDto> {
    const query = q?.trim();

    if (!query) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.CatalogSearchQueryRequired,
      );
    }

    const results = await this.musicItemService.search(query);
    return { results };
  }

  @Get()
  @ApiOkResponse({ type: PagedResponseDto(MusicEntryResponseDto) })
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
    @Query("loan") loan?: string,
  ): Promise<PagedResult<MusicEntryDto>> {
    return this.musicLibraryService.listEntries(user.sub, {
      ...parseListEntriesQuery({
        q,
        favorite,
        status,
        sort,
        order,
        page,
        limit,
        lang,
        loan,
      }),
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
    @Query("loan") loan?: string,
  ): Promise<PileSummaryDto> {
    return this.musicLibraryService.getPile(user.sub, {
      ...parseListEntriesQuery({ q, favorite, status, lang, loan }),
    });
  }

  @Put()
  @ApiOkResponse({ type: MusicEntryResponseDto })
  async upsertEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertMusicEntryDto,
  ): Promise<MusicEntryDto> {
    return this.musicLibraryService.upsertEntry(user.sub, dto);
  }

  @Get("entries/:id")
  @ApiOkResponse({ type: MusicEntryResponseDto })
  async getEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<MusicEntryDto> {
    return this.musicLibraryService.getEntry(user.sub, entryId);
  }

  @Patch("entries/:id")
  @ApiOkResponse({ type: MusicEntryResponseDto })
  async updateEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: UpdateMusicEntryDto,
  ): Promise<MusicEntryDto> {
    return this.musicLibraryService.updateEntry(user.sub, entryId, dto);
  }

  /** One change applied to many entries (UX-04), with a single update's side effects on each. */
  @HttpCode(HttpStatus.OK)
  @Post("entries/bulk")
  @ApiOkResponse({ type: BulkEntriesResultResponseDto })
  async bulkUpdate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkUpdateMusicEntriesBody,
  ): Promise<BulkEntriesResultDto> {
    return this.musicLibraryService.bulkUpdate(user.sub, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("entries/bulk-delete")
  @ApiOkResponse({ type: BulkEntriesResultResponseDto })
  async bulkDelete(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkEntriesTargetBody,
  ): Promise<BulkEntriesResultDto> {
    return this.musicLibraryService.bulkDelete(user.sub, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("entries/:id")
  async deleteEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<void> {
    await this.musicLibraryService.deleteEntry(user.sub, entryId);
  }

  /** The page's first paint, from the stored album alone (no MusicBrainz call). */
  @Get(":source/:sourceId/stored")
  @ApiOkResponse({ type: StoredMusicDetailResponseDto })
  async getStoredMusicDetail(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("sourceId") sourceId: string,
  ): Promise<StoredMusicDetailDto> {
    return {
      detail: await this.musicLibraryService.getStoredMusicDetail(
        user.sub,
        parseMusicSource(sourceParam),
        sourceId,
      ),
    };
  }

  /** Album detail page: catalogue metadata + the user's library state. */
  @Get(":source/:sourceId")
  @ApiOkResponse({ type: MusicDetailResponseDto })
  async getMusicDetail(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("sourceId") sourceId: string,
  ): Promise<MusicDetailDto> {
    return this.musicLibraryService.getMusicDetail(
      user.sub,
      parseMusicSource(sourceParam),
      sourceId,
    );
  }
}

function parseMusicSource(value: string): MusicSource {
  return parseEnumParam(value, [MusicSource.MUSICBRAINZ], "music source");
}
