export type JobStatus = "SUCCESS" | "FAILURE";

export interface JobRunDto {
  id: string;
  jobKey: string;
  startedAt: string;
  finishedAt: string;
  status: JobStatus;
  /** Short human outcome, e.g. "3 notification(s) créée(s)". */
  summary: string | null;
  /** Present only when `status` is "FAILURE". */
  error: string | null;
}

/**
 * One background job the admin can inspect/trigger, with its recent runs.
 *
 * Labels are derived from `key` by the web. Execution times and the effective
 * scheduler time zone come from the server.
 */
export interface JobDto {
  key: string;
  /** Most recent runs first. */
  runs: JobRunDto[];
  runningSince: string | null;
  timeZone: string | null;
  nextRunAt: string | null;
  /** First scheduled slot without a recorded run; null while running or on time. */
  overdueSince: string | null;
}

export interface JobListResponseDto {
  jobs: JobDto[];
}
