import type {
  AuthorPagesDto,
  BookExtremeDto,
  BookStatsDto,
} from "@loomkeep/shared";

class BookExtremeResponseDto implements BookExtremeDto {
  title!: string;
  pages!: number;
  href!: string;
}

class AuthorPagesResponseDto implements AuthorPagesDto {
  author!: string;
  pages!: number;
}

export class BookStatsResponseDto implements BookStatsDto {
  pagesRead!: number;
  avgPagesPerRead!: number | null;
  longestBook!: BookExtremeResponseDto | null;
  shortestBook!: BookExtremeResponseDto | null;
  topAuthorsByPages!: AuthorPagesResponseDto[];
  distinctAuthorsCount!: number;
  rereadsCount!: number;
  stagnantInProgressCount!: number;
}
