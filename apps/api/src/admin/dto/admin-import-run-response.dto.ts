import type { AdminImportRunDto, JobStatus } from "@loomkeep/shared";

export class AdminImportRunResponseDto implements AdminImportRunDto {
  id!: string;
  userId!: string | null;
  identifier!: string | null;
  sourceId!: string;
  status!: JobStatus;
  itemCount!: number;
  overwrite!: boolean;
  summary!: string | null;
  error!: string | null;
  startedAt!: string;
  finishedAt!: string;
}
