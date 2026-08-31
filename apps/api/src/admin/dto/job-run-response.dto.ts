import type { JobRunDto, JobStatus } from "@loomkeep/shared";

export class JobRunResponseDto implements JobRunDto {
  id!: string;
  jobKey!: string;
  startedAt!: string;
  finishedAt!: string;
  status!: JobStatus;
  summary!: string | null;
  error!: string | null;
}
