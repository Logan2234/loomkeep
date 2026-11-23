import type {
  BookStatus,
  GameStatus,
  ImportReportTile,
} from "@loomkeep/shared";

export class ImportReportTileResponseDto implements ImportReportTile {
  id?:
    | BookStatus
    | GameStatus
    | "books"
    | "games"
    | "series"
    | "movies"
    | "episodes"
    | "playtime"
    | "notFound";

  label!: string;
  value!: number;
  watchlistCount?: number;
  sub!: string | null;
}
