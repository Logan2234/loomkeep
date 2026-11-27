import type { FiguresDto, MyYearDto } from "@loomkeep/shared/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";

class MyYearVideoResponseDto {
  movies!: number;
  episodes!: number;
  minutes!: number;
}

class MyYearGamesResponseDto {
  finished!: number;
  minutes!: number;
}

class MyYearBooksResponseDto {
  read!: number;
  pages!: number;
}

class MyYearMusicResponseDto {
  listened!: number;
}

export class FiguresResponseDto implements FiguresDto {
  @ApiPropertyOptional({ type: MyYearVideoResponseDto })
  video?: MyYearVideoResponseDto;

  @ApiPropertyOptional({ type: MyYearGamesResponseDto })
  games?: MyYearGamesResponseDto;

  @ApiPropertyOptional({ type: MyYearBooksResponseDto })
  books?: MyYearBooksResponseDto;

  @ApiPropertyOptional({ type: MyYearMusicResponseDto })
  music?: MyYearMusicResponseDto;
}

export class MyYearResponseDto extends FiguresResponseDto implements MyYearDto {
  year!: number;
}
