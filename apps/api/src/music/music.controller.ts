import type { PagedResult } from "@loomkeep/shared";
import {
  Domain,
  ErrorCode,
  MusicDetailDto,
  MusicEntryDto,
  MusicSearchResponseDto,
  MusicSource,
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
  Put,
  Query,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { toQueryArray } from "../common/query-array.util";
import { DomainGateService } from "../users/domain-gate.service";
import { MusicDetailResponseDto } from "./dto/music-detail-response.dto";
import { MusicEntryResponseDto } from "./dto/music-entry-response.dto";
import { MusicSearchResultResponseDto } from "./dto/music-search-response.dto";
import { UpdateMusicEntryDto } from "./dto/update-music-entry.dto";
import { UpsertMusicEntryDto } from "./dto/upsert-music-entry.dto";
import { MusicItemService } from "./music-item.service";
import { MusicLibraryService } from "./music-library.service";

@Controller("music")
export class MusicController {
  constructor(
    private readonly musicItemService: MusicItemService,
    private readonly musicLibraryService: MusicLibraryService,
    private readonly domainGate: DomainGateService,
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

    await this.domainGate.assertEnabled(user.sub, Domain.MUSIC);

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
  ): Promise<PagedResult<MusicEntryDto>> {
    await this.domainGate.assertEnabled(user.sub, Domain.MUSIC);
    return this.musicLibraryService.listEntries(user.sub, {
      q,
      favorite: favorite === "true",
      statuses: toQueryArray(status),
      sort,
      order: order === "asc" ? "asc" : "desc",
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Put()
  @ApiOkResponse({ type: MusicEntryResponseDto })
  async upsertEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertMusicEntryDto,
  ): Promise<MusicEntryDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MUSIC);
    return this.musicLibraryService.upsertEntry(user.sub, dto);
  }

  @Get("entries/:id")
  @ApiOkResponse({ type: MusicEntryResponseDto })
  async getEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<MusicEntryDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MUSIC);
    return this.musicLibraryService.getEntry(user.sub, entryId);
  }

  @Patch("entries/:id")
  @ApiOkResponse({ type: MusicEntryResponseDto })
  async updateEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: UpdateMusicEntryDto,
  ): Promise<MusicEntryDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MUSIC);
    return this.musicLibraryService.updateEntry(user.sub, entryId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("entries/:id")
  async deleteEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<void> {
    await this.domainGate.assertEnabled(user.sub, Domain.MUSIC);
    await this.musicLibraryService.deleteEntry(user.sub, entryId);
  }

  /** Album detail page: catalogue metadata + the user's library state. */
  @Get(":source/:sourceId")
  @ApiOkResponse({ type: MusicDetailResponseDto })
  async getMusicDetail(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("sourceId") sourceId: string,
  ): Promise<MusicDetailDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MUSIC);
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
