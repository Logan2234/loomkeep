import type {
  EntryStatus,
  LibrarySagaDto,
  LibrarySagasDto,
  MediaSagaDto,
  MediaSagaResponseDto as MediaSagaResponse,
  SagaMemberDto,
} from "@loomkeep/shared";
import { MediaSummaryResponseDto } from "../../catalog/dto/media-summary-response.dto";

export class SagaMemberResponseDto
  extends MediaSummaryResponseDto
  implements SagaMemberDto
{
  releaseDate!: string | null;
  format!: string | null;
  episodes!: number | null;
  upcoming!: boolean;
  status!: EntryStatus | null;
}

export class MediaSagaBodyResponseDto implements MediaSagaDto {
  key!: string;
  title!: string;
  members!: SagaMemberResponseDto[];
}

export class MediaSagaResponseDto implements MediaSagaResponse {
  saga!: MediaSagaBodyResponseDto | null;
}

export class LibrarySagaResponseDto implements LibrarySagaDto {
  key!: string;
  title!: string;
  members!: SagaMemberResponseDto[];
  next!: SagaMemberResponseDto | null;
  seen!: number;
  released!: number;
  lastActivityAt!: string;
  finishedAt!: string | null;
}

export class LibrarySagasResponseDto implements LibrarySagasDto {
  inProgress!: LibrarySagaResponseDto[];
  waiting!: LibrarySagaResponseDto[];
  finished!: LibrarySagaResponseDto[];
}
