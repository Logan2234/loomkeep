import type {
  ImportAnalyzeRequest,
  ImportCommitRequest,
  ImportSource,
} from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

export const getImportAvailability = () => typedRequest("/import/availability");

export const getImportQuota = () => typedRequest("/import/quota");

/** Analyse an export → reconciliation plan (writes nothing). Poll the job. */
export const analyzeImport = (
  source: ImportSource,
  body: ImportAnalyzeRequest,
) =>
  typedRequest("/import/{source}/analyze", {
    method: "POST",
    params: { source },
    body,
  });

/** Commit an analysed import with the user's reconciliation decisions. */
export const commitImport = (
  source: ImportSource,
  jobId: string,
  body: ImportCommitRequest,
) =>
  typedRequest("/import/{source}/{jobId}/commit", {
    method: "POST",
    params: { source, jobId },
    body,
  });

/** Poll an import job's progress and, once finished, its plan or report. */
export const getImportJob = (source: ImportSource, jobId: string) =>
  typedRequest("/import/{source}/{jobId}", { params: { source, jobId } });
