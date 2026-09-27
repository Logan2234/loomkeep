import type {
  BookSessionDto,
  BookSessionMutationDto,
  BookSessionSummaryDto,
  SessionSource,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class BookSessionResponseDto implements BookSessionDto {
  id!: string;
  durationMinutes!: number;
  pagesRead!: number;
  startPage!: number | null;
  endPage!: number | null;
  occurredAt!: string;
  source!: SessionSource;
  createdAt!: string;
  updatedAt!: string;
}

export class BookSessionSummaryResponseDto implements BookSessionSummaryDto {
  @ApiProperty({ type: BookSessionResponseDto, isArray: true })
  items!: BookSessionResponseDto[];

  hasMore!: boolean;
  totalTrackedMinutes!: number;
  totalPagesRead!: number;
  weekMinutes!: number;
  monthMinutes!: number;
  averagePagesPerDay!: number | null;
  estimatedCompletionDate!: string | null;
  completionSuggested!: boolean;
}

export class BookSessionMutationResponseDto implements BookSessionMutationDto {
  @ApiProperty({ type: BookSessionResponseDto })
  session!: BookSessionResponseDto;

  @ApiProperty({ type: BookSessionSummaryResponseDto })
  summary!: BookSessionSummaryResponseDto;

  xpAwarded!: boolean;
}
