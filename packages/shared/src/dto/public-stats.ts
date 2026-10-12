/** `GET /public-stats/summary` response — minimal, cheap counters for the Homepage widget. */
export interface PublicStatsSummaryDto {
  status: "ok";
  userCount: number;
  openReports: number;
  newUsers7d: number;
  /** "<healthy>/<total>" of live (non comingSoon) external services. */
  operational: string;
  gitSha: string;
}
