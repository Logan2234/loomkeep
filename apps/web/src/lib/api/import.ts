import type {
  ImportAnalyzeRequest,
  ImportCommitRequest,
  ImportJobDto,
} from "@loomkeep/shared";
import { request } from "./core";

/** Analyse an export → reconciliation plan (writes nothing). Poll the job. */
export function analyzeImport(
  source: string,
  body: ImportAnalyzeRequest,
): Promise<ImportJobDto> {
  return request(`/import/${source}/analyze`, { method: "POST", body });
}

/** Commit an analysed import with the user's reconciliation decisions. */
export function commitImport(
  source: string,
  jobId: string,
  body: ImportCommitRequest,
): Promise<ImportJobDto> {
  return request(`/import/${source}/${jobId}/commit`, { method: "POST", body });
}

/** Poll an import job's progress and, once finished, its plan or report. */
export function getImportJob(
  source: string,
  jobId: string,
): Promise<ImportJobDto> {
  return request(`/import/${source}/${jobId}`);
}
