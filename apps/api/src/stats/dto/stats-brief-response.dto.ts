import type { StatsBriefDto } from "@loomkeep/shared";

export class StatsBriefResponseDto implements StatsBriefDto {
  episodes!: number | null;
  movies!: number | null;
  games!: number | null;
  books!: number | null;
  albums!: number | null;
}
