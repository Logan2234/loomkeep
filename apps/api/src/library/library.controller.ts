import type {
  CalendarEntryDto,
  EntryEpisodesResponseDto,
  EpisodeWatchDto,
  LibraryDomainCountsDto,
  LibraryEntryDto,
  MediaType,
  PagedResult,
} from "@loomkeep/shared";
import { Domain, Locale } from "@loomkeep/shared";
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
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { toQueryArray } from "../common/query-array.util";
import { DomainGateService } from "../users/domain-gate.service";
import { AddMovieReplayDto } from "./dto/add-movie-replay.dto";
import { CalendarEntryResponseDto } from "./dto/calendar-entry-response.dto";
import { EntryEpisodesResponseResponseDto } from "./dto/entry-episodes-response.dto";
import { EpisodeWatchResponseDto } from "./dto/episode-watch-response.dto";
import { LibraryDomainCountsResponseDto } from "./dto/library-domain-counts-response.dto";
import { LibraryEntryResponseDto } from "./dto/library-entry-response.dto";
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
  @ApiOkResponse({ type: PagedResponseDto(LibraryEntryResponseDto) })
  async listEntries(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
    @Query("favorite") favorite?: string,
    @Query("status") status?: string | string[],
    @Query("type") type?: string | string[],
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("lang") lang?: string,
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
      limit: limit ? Number(limit) : undefined,
      lang: Locale.includes(lang as Locale) ? lang : undefined,
    });
  }

  @Put()
  @ApiOkResponse({ type: LibraryEntryResponseDto })
  upsertEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertEntryDto,
  ): Promise<LibraryEntryDto> {
    return this.libraryService.upsertEntry(user.sub, dto);
  }

  /** Per domain, how many items the user tracks — hidden domains included. */
  @Get("domain-counts")
  @ApiOkResponse({ type: LibraryDomainCountsResponseDto })
  getDomainCounts(
    @CurrentUser() user: JwtPayload,
  ): Promise<LibraryDomainCountsDto> {
    return this.libraryService.getDomainCounts(user.sub);
  }

  @Get("calendar")
  @ApiOkResponse({ type: CalendarEntryResponseDto, isArray: true })
  getCalendar(@CurrentUser() user: JwtPayload): Promise<CalendarEntryDto[]> {
    return this.libraryService.getCalendar(user.sub);
  }

  @Get("entries/:id")
  @ApiOkResponse({ type: LibraryEntryResponseDto })
  getEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<LibraryEntryDto> {
    return this.libraryService.getEntry(user.sub, entryId);
  }

  @Patch("entries/:id")
  @ApiOkResponse({ type: LibraryEntryResponseDto })
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

  /** Log a completed rewatch (a completion beyond the entry's first one). */
  @Post("entries/:id/replays")
  @ApiCreatedResponse({ type: LibraryEntryResponseDto })
  addReplay(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: AddMovieReplayDto,
  ): Promise<LibraryEntryDto> {
    return this.libraryService.addReplay(user.sub, entryId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("replays/:id")
  async deleteReplay(
    @CurrentUser() user: JwtPayload,
    @Param("id") replayId: string,
  ): Promise<void> {
    await this.libraryService.deleteReplay(user.sub, replayId);
  }

  @Get("entries/:id/episodes")
  @ApiOkResponse({ type: EntryEpisodesResponseResponseDto })
  getEntryEpisodes(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<EntryEpisodesResponseDto> {
    return this.libraryService.getEntryEpisodes(user.sub, entryId);
  }

  @Post("episodes/:episodeId/watches")
  @ApiCreatedResponse({ type: EpisodeWatchResponseDto })
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
  @Delete("seasons/:seasonId/watches")
  async unwatchSeason(
    @CurrentUser() user: JwtPayload,
    @Param("seasonId") seasonId: string,
  ): Promise<void> {
    await this.libraryService.unwatchSeason(user.sub, seasonId);
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
