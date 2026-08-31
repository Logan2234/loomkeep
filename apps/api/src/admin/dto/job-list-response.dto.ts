import type { JobDto, JobListResponseDto } from "@loomkeep/shared";
import { JobRunResponseDto } from "./job-run-response.dto";

class JobResponseDto implements JobDto {
  key!: string;
  label!: string;
  schedule!: string;
  runs!: JobRunResponseDto[];
}

export class JobListResponseResponseDto implements JobListResponseDto {
  jobs!: JobResponseDto[];
}
