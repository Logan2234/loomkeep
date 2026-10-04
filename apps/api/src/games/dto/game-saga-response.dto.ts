import type {
  GameSagaDto,
  GameSagaMemberDto,
  GameSagaResponseDto as GameSagaResponse,
  GameStatus,
  LibraryGameSagasDto,
  LibrarySagaDto,
  ReleaseDatePrecision,
} from "@loomkeep/shared";
import { GameSummaryResponseDto } from "./game-summary-response.dto";

export class GameSagaMemberResponseDto
  extends GameSummaryResponseDto
  implements GameSagaMemberDto
{
  releaseDate!: string | null;
  releaseDatePrecision!: ReleaseDatePrecision | null;
  upcoming!: boolean;
  status!: GameStatus | null;
}

export class GameSagaBodyResponseDto implements GameSagaDto {
  key!: string;
  title!: string;
  members!: GameSagaMemberResponseDto[];
}

export class GameSagaResponseDto implements GameSagaResponse {
  saga!: GameSagaBodyResponseDto | null;
}

export class LibraryGameSagaResponseDto implements LibrarySagaDto<GameSagaMemberDto> {
  key!: string;
  title!: string;
  members!: GameSagaMemberResponseDto[];
  next!: GameSagaMemberResponseDto | null;
  seen!: number;
  released!: number;
  lastActivityAt!: string;
  finishedAt!: string | null;
}

export class LibraryGameSagasResponseDto implements LibraryGameSagasDto {
  inProgress!: LibraryGameSagaResponseDto[];
  waiting!: LibraryGameSagaResponseDto[];
  finished!: LibraryGameSagaResponseDto[];
}
