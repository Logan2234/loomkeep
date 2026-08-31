import type { ImportItemContext } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

// ImportItemContext is a 4-branch discriminated union — each branch gets its
// own class and the containing DTO composes them with @ApiExtraModels +
// oneOf, same technique as auth/dto/login-response.dto.ts.
type BookContext = Extract<ImportItemContext, { kind: "book" }>;
type GameContext = Extract<ImportItemContext, { kind: "game" }>;
type SeriesContext = Extract<ImportItemContext, { kind: "series" }>;
type MovieContext = Extract<ImportItemContext, { kind: "movie" }>;

class BookImportContextResponseDto implements BookContext {
  @ApiProperty({ enum: ["book"] })
  kind!: "book";

  rating!: number | null;
}

class GameImportContextResponseDto implements GameContext {
  @ApiProperty({ enum: ["game"] })
  kind!: "game";

  playtimeMinutes!: number;
  recentlyPlayed!: boolean;
  unknownTitle?: boolean;
}

class SeriesImportContextResponseDto implements SeriesContext {
  @ApiProperty({ enum: ["series"] })
  kind!: "series";

  episodesWatched!: number;
  rating!: number | null;
  favorite!: boolean;
}

class MovieImportContextResponseDto implements MovieContext {
  @ApiProperty({ enum: ["movie"] })
  kind!: "movie";

  year!: number | null;
  rewatches!: number;
  rating!: number | null;
  favorite!: boolean;
}

export const IMPORT_ITEM_CONTEXT_MODELS = [
  BookImportContextResponseDto,
  GameImportContextResponseDto,
  SeriesImportContextResponseDto,
  MovieImportContextResponseDto,
] as const;
