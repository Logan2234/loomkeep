import type { JobDto, JobListResponseDto } from "@loomkeep/shared";
import { JobRunResponseDto } from "./job-run-response.dto";

class JobResponseDto implements JobDto {
  key!: string;
  runningSince!: string | null;
  timeZone!: string | null;
  nextRunAt!: string | null;
  overdueSince!: string | null;
  runs!: JobRunResponseDto[];
}

export class JobListResponseResponseDto implements JobListResponseDto {
  jobs!: JobResponseDto[];
}
