import type {
  EntryStatus,
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
