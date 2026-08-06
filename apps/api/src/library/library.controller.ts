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
import type {
  CalendarEntryDto,
  EntryEpisodesResponseDto,
  EpisodeWatchDto,
  LibraryEntryDto,
  MediaType,
  PagedResult,
} from "@loomkeep/shared";
import { Domain } from "@loomkeep/shared";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { toQueryArray } from "../common/query-array.util";
import { DomainGateService } from "../users/domain-gate.service";
import { UpdateEntryDto } from "./dto/update-entry.dto";
import { UpsertEntryDto } from "./dto/upsert-entry.dto";
import { WatchEpisodeDto } from "./dto/watch-episode.dto";
import { LibraryService } from "./library.service";

@Controller("library")
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly domainGate: DomainGateService,
  ) {}

  @Get()
  async listEntries(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
    @Query("favorite") favorite?: string,
    @Query("status") status?: string | string[],
    @Query("type") type?: string | string[],
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("page") page?: string,
  ): Promise<PagedResult<LibraryEntryDto>> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    return this.libraryService.listEntries(user.sub, {
      q,
      favorite: favorite === "true",
      statuses: toQueryArray(status),
      types: toQueryArray(type) as MediaType[],
      sort,
      order: order === "asc" ? "asc" : "desc",
      page: page ? Number(page) : undefined,
    });
  }

  @Put()
  upsertEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertEntryDto,
  ): Promise<LibraryEntryDto> {
    return this.libraryService.upsertEntry(user.sub, dto);
  }

  @Get("calendar")
  getCalendar(@CurrentUser() user: JwtPayload): Promise<CalendarEntryDto[]> {
    return this.libraryService.getCalendar(user.sub);
  }

  @Get("entries/:id")
  getEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<LibraryEntryDto> {
    return this.libraryService.getEntry(user.sub, entryId);
  }

  @Patch("entries/:id")
  updateEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: UpdateEntryDto,
  ): Promise<LibraryEntryDto> {
    return this.libraryService.updateEntry(user.sub, entryId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("entries/:id")
  async deleteEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<void> {
    await this.libraryService.deleteEntry(user.sub, entryId);
  }

  @Get("entries/:id/episodes")
  getEntryEpisodes(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<EntryEpisodesResponseDto> {
    return this.libraryService.getEntryEpisodes(user.sub, entryId);
  }

  @Post("episodes/:episodeId/watches")
  watchEpisode(
    @CurrentUser() user: JwtPayload,
    @Param("episodeId") episodeId: string,
    @Body() dto: WatchEpisodeDto,
  ): Promise<EpisodeWatchDto> {
    return this.libraryService.watchEpisode(user.sub, episodeId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("seasons/:seasonId/watches")
  async watchSeason(
    @CurrentUser() user: JwtPayload,
    @Param("seasonId") seasonId: string,
  ): Promise<void> {
    await this.libraryService.watchSeason(user.sub, seasonId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("episodes/:episodeId/watch-through")
  async watchThrough(
    @CurrentUser() user: JwtPayload,
    @Param("episodeId") episodeId: string,
  ): Promise<void> {
    await this.libraryService.watchThrough(user.sub, episodeId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("episodes/:episodeId/watches")
  async unwatchEpisode(
    @CurrentUser() user: JwtPayload,
    @Param("episodeId") episodeId: string,
  ): Promise<void> {
    await this.libraryService.unwatchEpisode(user.sub, episodeId);
  }
}
