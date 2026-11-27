import type { GameSearchResponseDto } from "@loomkeep/shared/contracts";
import { GameSummaryResponseDto } from "./game-summary-response.dto";

export class GameSearchResultResponseDto implements GameSearchResponseDto {
  results!: GameSummaryResponseDto[];
}
