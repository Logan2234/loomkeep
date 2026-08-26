import type { PagedResult } from "@loomkeep/shared";
import {
  BookDetailDto,
  BookEntryDto,
  BookSearchResponseDto,
  BookSource,
  Domain,
  ReadingGoalDto,
} from "@loomkeep/shared";
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
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { toQueryArray } from "../common/query-array.util";
import { AgeGateService } from "../users/age-gate.service";
import { filterAdultContent } from "../users/age.util";
import { DomainGateService } from "../users/domain-gate.service";
import { BookItemService } from "./book-item.service";
import { BookLibraryService } from "./book-library.service";
import { AddBookReplayDto } from "./dto/add-book-replay.dto";
import { UpdateBookEntryDto } from "./dto/update-book-entry.dto";
import { UpsertBookEntryDto } from "./dto/upsert-book-entry.dto";
import { UpsertReadingGoalDto } from "./dto/upsert-reading-goal.dto";

@Controller("books")
export class BooksController {
  constructor(
    private readonly bookItemService: BookItemService,
    private readonly bookLibraryService: BookLibraryService,
    private readonly domainGate: DomainGateService,
    private readonly ageGate: AgeGateService,
  ) {}

  /** Live catalogue search (Open Library). */
  @Get("search")
  async search(
    @CurrentUser() user: JwtPayload,
    @Query("q") q?: string,
  ): Promise<BookSearchResponseDto> {
    const query = q?.trim();

    if (!query) {
      throw new BadRequestException("Query 'q' is required");
    }

    await this.domainGate.assertEnabled(user.sub, Domain.BOOKS);

    const [results, allowAdult] = await Promise.all([
      this.bookItemService.search(query),
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
  ): Promise<PagedResult<BookEntryDto>> {
    await this.domainGate.assertEnabled(user.sub, Domain.BOOKS);
    return this.bookLibraryService.listEntries(user.sub, {
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
    @Body() dto: UpsertBookEntryDto,
  ): Promise<BookEntryDto> {
    return this.bookLibraryService.upsertEntry(user.sub, dto);
  }

  @Get("entries/:id")
  getEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<BookEntryDto> {
    return this.bookLibraryService.getEntry(user.sub, entryId);
  }

  @Patch("entries/:id")
  updateEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: UpdateBookEntryDto,
  ): Promise<BookEntryDto> {
    return this.bookLibraryService.updateEntry(user.sub, entryId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("entries/:id")
  async deleteEntry(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
  ): Promise<void> {
    await this.bookLibraryService.deleteEntry(user.sub, entryId);
  }

  /** Log a completed reread (a completion beyond the entry's first one). */
  @Post("entries/:id/replays")
  addReplay(
    @CurrentUser() user: JwtPayload,
    @Param("id") entryId: string,
    @Body() dto: AddBookReplayDto,
  ): Promise<BookEntryDto> {
    return this.bookLibraryService.addReplay(user.sub, entryId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("replays/:id")
  async deleteReplay(
    @CurrentUser() user: JwtPayload,
    @Param("id") replayId: string,
  ): Promise<void> {
    await this.bookLibraryService.deleteReplay(user.sub, replayId);
  }

  /** The current user's reading goal for `year` (defaults to this year) + progress. */
  @Get("reading-goal")
  getReadingGoal(
    @CurrentUser() user: JwtPayload,
    @Query("year") year?: string,
  ): Promise<ReadingGoalDto> {
    return this.bookLibraryService.getReadingGoal(
      user.sub,
      year ? Number(year) : new Date().getFullYear(),
    );
  }

  @Put("reading-goal")
  upsertReadingGoal(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertReadingGoalDto,
  ): Promise<ReadingGoalDto> {
    return this.bookLibraryService.upsertReadingGoal(user.sub, dto);
  }

  /** Book detail page: catalogue metadata + the user's library state. */
  @Get(":source/:sourceId")
  getBookDetail(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("sourceId") sourceId: string,
  ): Promise<BookDetailDto> {
    return this.bookLibraryService.getBookDetail(
      user.sub,
      parseBookSource(sourceParam),
      sourceId,
    );
  }
}

function parseBookSource(value: string): BookSource {
  return parseEnumParam(value, [BookSource.OPEN_LIBRARY], "book source");
}
