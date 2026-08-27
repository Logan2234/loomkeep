import type {
  CalendarEntryDto,
  EntryEpisodesResponseDto,
  EpisodeWatchDto,
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
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { toQueryArray } from "../common/query-array.util";
import { DomainGateService } from "../users/domain-gate.service";
import { AddMovieReplayDto } from "./dto/add-movie-replay.dto";
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
      lang: Locale.includes(lang as Locale) ? lang : undefined,
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

  /**
   * Public (no auth) so Google/Apple Calendar can poll it directly by URL —
   * subscription clients can't send an Authorization header. Gated by the
   * unguessable per-user `calendarToken` instead (see UsersController's
   * calendar-token endpoints), same pattern as the avatar route.
   */
  @Public()
  @Get("calendar.ics")
  async getCalendarIcs(
    @Query("token") token: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const ics = token ? await this.libraryService.getCalendarIcs(token) : null;

    if (!ics) {
      throw new NotFoundException();
    }

    reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Content-Disposition", 'inline; filename="loomkeep.ics"')
      .send(ics);
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

  /** Log a completed rewatch (a completion beyond the entry's first one). */
  @Post("entries/:id/replays")
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
