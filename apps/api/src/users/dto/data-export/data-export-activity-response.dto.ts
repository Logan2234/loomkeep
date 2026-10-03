import type { DataExportActivity } from "@loomkeep/shared";

export class DataExportActivityResponseDto implements DataExportActivity {
  /**
   * What happened.
   * @example "COMPLETED"
   */
  type!: string;

  /**
   * The domain it happened in.
   * @example "MEDIA"
   */
  domain!: string;

  /**
   * The work it's about.
   * @example "Dune: Part Two"
   */
  title!: string;

  /**
   * Where it leads in the app.
   * @example "/app/media/movie/693134"
   */
  href!: string | null;

  /**
   * When it happened.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}
