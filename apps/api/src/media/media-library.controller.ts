import { Locale } from "@loomkeep/shared/catalog";
import type {
  BulkEntriesResultDto,
  EntryEpisodesResponseDto,
  EpisodeWatchBatchResultDto,
  EpisodeWatchDto,
  LibraryEntryDto,
  LibrarySagasDto,
  PagedResult,
  PileSummaryDto,
  TrackedMediaDto,
} from "@loomkeep/shared/contracts";
import { LIBRARY_SAGA_SORTS } from "@loomkeep/shared/contracts";
import type { MediaType } from "@loomkeep/shared/enums";
import { Domain } from "@loomkeep/shared/enums";
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { PileSummaryResponseDto } from "../stats/dto/pile-summary-response.dto";
import { DomainGateService } from "../users/domain-gate.service";
import {
  BulkEntriesResultResponseDto,
  BulkEntriesTargetBody,
} from "../work/dto/bulk-entries.dto";
import { parseListEntriesQuery } from "../work/entry-lifecycle.util";
import { AddMovieReplayDto } from "./dto/add-movie-replay.dto";
import { BulkUpdateEntriesBody } from "./dto/bulk-update-entries.dto";
import { EntryEpisodesResponseResponseDto } from "./dto/entry-episodes-response.dto";
import { EpisodeWatchResponseDto } from "./dto/episode-watch-response.dto";
import {
  EpisodeWatchBatchResponseDto,
  EpisodeWatchesBatchDto,
  UndoEpisodeWatchesDto,
} from "./dto/episode-watches-batch.dto";
import { LibraryEntryResponseDto } from "./dto/library-entry-response.dto";
import { LibrarySagasResponseDto } from "./dto/media-saga-response.dto";
import { TrackedMediaResponseDto } from "./dto/tracked-media-response.dto";
import { UpdateEntryDto } from "./dto/update-entry.dto";
import { UpsertEntryDto } from "./dto/upsert-entry.dto";
import { WatchEpisodeDto } from "./dto/watch-episode.dto";
import { MediaEpisodesService } from "./media-episodes.service";
import { MediaLibraryService } from "./media-library.service";
import { MediaSagaService } from "./media-saga.service";

@Controller("media")
export class MediaLibraryController {
  constructor(
    private readonly libraryService: MediaLibraryService,
    private readonly episodes: MediaEpisodesService,
    private readonly domainGate: DomainGateService,
    private readonly sagas: MediaSagaService,
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
    @Query("loan") loan?: string,
  ): Promise<PagedResult<LibraryEntryDto>> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    return this.libraryService.listEntries(user.sub, {
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
      types: toQueryArray(type) as MediaType[],
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
    @Query("type") type?: string | string[],
    @Query("lang") lang?: string,
    @Query("loan") loan?: string,
  ): Promise<PileSummaryDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    return this.libraryService.getPile(user.sub, {
      ...parseListEntriesQuery({ q, favorite, status, lang, loan }),
      types: toQueryArray(type) as MediaType[],
    });
  }

  /** The sagas of the library in progress, and the ones waiting on a sequel. */
  @Get("sagas")
  @ApiOkResponse({ type: LibrarySagasResponseDto })
  async listSagas(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
    @Query("type") type?: string | string[],
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("lang") lang?: string,
  ): Promise<LibrarySagasDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    return this.sagas.listSagas(user.sub, {
      q,
      types: (toQueryArray(type) as MediaType[]).filter(
        (t) => t === "MOVIE" || t === "ANIME",
      ),
      sort: LIBRARY_SAGA_SORTS.find((s) => s === sort),
      order: order === "asc" ? "asc" : "desc",
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

  /**
   * Every tracked work with its effective status, in one pass — what the
   * search page flags results with. Its own route rather than draining the
   * paginated list: each page of that one re-ranks the whole library.
   */
  @Get("tracked")
  @ApiOkResponse({ type: TrackedMediaResponseDto, isArray: true })
  async listTracked(
    @CurrentUser() user: JwtPayload,
  ): Promise<TrackedMediaDto[]> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    return this.libraryService.trackedStatuses(user.sub);
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
    @Headers("accept-language") acceptLanguage?: string,
  ): Promise<LibraryEntryDto> {
    return this.libraryService.updateEntry(
      user.sub,
      entryId,
      dto,
      acceptLanguage,
    );
  }

  /** One change applied to many entries (UX-04), with a single update's side effects on each. */
  @HttpCode(HttpStatus.OK)
  @Post("entries/bulk")
  @ApiOkResponse({ type: BulkEntriesResultResponseDto })
  async bulkUpdate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkUpdateEntriesBody,
  ): Promise<BulkEntriesResultDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    return this.libraryService.bulkUpdate(user.sub, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("entries/bulk-delete")
  @ApiOkResponse({ type: BulkEntriesResultResponseDto })
  async bulkDelete(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkEntriesTargetBody,
  ): Promise<BulkEntriesResultDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    return this.libraryService.bulkDelete(user.sub, dto);
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
    return this.episodes.getEntryEpisodes(user.sub, entryId);
  }

  @HttpCode(HttpStatus.OK)
  @Post("episodes/watches/batch")
  @ApiOkResponse({ type: EpisodeWatchBatchResponseDto })
  batchEpisodeWatches(
    @CurrentUser() user: JwtPayload,
    @Body() dto: EpisodeWatchesBatchDto,
  ): Promise<EpisodeWatchBatchResultDto> {
    return this.episodes.batchEpisodeWatches(
      user.sub,
      dto.action,
      dto.episodeIds,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("episodes/watches/undo")
  async undoEpisodeWatches(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UndoEpisodeWatchesDto,
  ): Promise<void> {
    await this.episodes.undoEpisodeWatches(user.sub, dto);
  }

  @Post("episodes/:episodeId/watches")
  @ApiCreatedResponse({ type: EpisodeWatchResponseDto })
  watchEpisode(
    @CurrentUser() user: JwtPayload,
    @Param("episodeId") episodeId: string,
    @Body() dto: WatchEpisodeDto,
  ): Promise<EpisodeWatchDto> {
    return this.episodes.watchEpisode(user.sub, episodeId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("seasons/:seasonId/watches")
  async watchSeason(
    @CurrentUser() user: JwtPayload,
    @Param("seasonId") seasonId: string,
  ): Promise<void> {
    await this.episodes.watchSeason(user.sub, seasonId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("seasons/:seasonId/watches")
  async unwatchSeason(
    @CurrentUser() user: JwtPayload,
    @Param("seasonId") seasonId: string,
  ): Promise<void> {
    await this.episodes.unwatchSeason(user.sub, seasonId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("episodes/:episodeId/watch-through")
  async watchThrough(
    @CurrentUser() user: JwtPayload,
    @Param("episodeId") episodeId: string,
  ): Promise<void> {
    await this.episodes.watchThrough(user.sub, episodeId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("episodes/:episodeId/watches")
  async unwatchEpisode(
    @CurrentUser() user: JwtPayload,
    @Param("episodeId") episodeId: string,
  ): Promise<void> {
    await this.episodes.unwatchEpisode(user.sub, episodeId);
  }
}
