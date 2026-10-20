import type {
  BookSessionDto,
  BookSessionMutationDto,
  BookSessionSummaryDto,
  SessionSource,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { SessionWeekDayResponseDto } from "../../common/dto/session-week-day-response.dto";
import { BookReadingResponseDto } from "./book-entry-response.dto";

export class BookSessionResponseDto implements BookSessionDto {
  id!: string;
  readingId!: string | null;
  readingNumber!: number | null;
  durationMinutes!: number;
  pagesRead!: number;
  startPage!: number | null;
  endPage!: number | null;
  notes!: string | null;
  occurredAt!: string;
  source!: SessionSource;
  createdAt!: string;
  updatedAt!: string;
}

export class BookSessionSummaryResponseDto implements BookSessionSummaryDto {
  @ApiProperty({ type: BookSessionResponseDto, isArray: true })
  items!: BookSessionResponseDto[];

  hasMore!: boolean;
  totalSessions!: number;
  totalTrackedMinutes!: number;
  totalPagesRead!: number;
  weekMinutes!: number;
  weekSessions!: number;

  @ApiProperty({ type: SessionWeekDayResponseDto, isArray: true })
  weekDays!: SessionWeekDayResponseDto[];

  monthMinutes!: number;
  averagePagesPerDay!: number | null;
  estimatedCompletionDate!: string | null;
  completionSuggested!: boolean;

  @ApiProperty({ type: BookReadingResponseDto, nullable: true })
  activeReading!: BookReadingResponseDto | null;
}

export class BookSessionMutationResponseDto implements BookSessionMutationDto {
  @ApiProperty({ type: BookSessionResponseDto })
  session!: BookSessionResponseDto;

  @ApiProperty({ type: BookSessionSummaryResponseDto })
  summary!: BookSessionSummaryResponseDto;

  xpAwarded!: boolean;
}
