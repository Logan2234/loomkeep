import type { ApiV1HistoryEventDto } from "@loomkeep/shared";

export class ApiV1HistoryPagesResponseDto implements NonNullable<
  ApiV1HistoryEventDto["pages"]
> {
  /**
   * Pages read during the session.
   * @example 20
   */
  read!: number;

  /**
   * First page of the session, when given.
   * @example 100
   */
  from!: number | null;

  /**
   * Last page of the session, when given.
   * @example 120
   */
  to!: number | null;
}
