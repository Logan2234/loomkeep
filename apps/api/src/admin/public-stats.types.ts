/** `GET /public-stats/summary` response — minimal, cheap counters for the Homepage widget. */
export interface PublicStatsSummaryDto {
  status: "ok";
  userCount: number;
  openReports: number;
  newUsers7d: number;
  /** "<healthy>/<total>" of live (non comingSoon) external services. */
  operational: string;
  gitSha: string;
  /** The running version (root package.json). */
  version: string;
  /** Newest published version, "unknown" until a check succeeded or when checks are off. */
  latestVersion: string;
  /** Strings rather than a boolean: Homepage's customapi widget renders text. */
  updateAvailable: "yes" | "no" | "unknown";
}
