import type { GameSearchResponseDto } from "@loomkeep/shared";
import { GameSummaryResponseDto } from "./game-summary-response.dto";

export class GameSearchResultResponseDto implements GameSearchResponseDto {
  results!: GameSummaryResponseDto[];
}
