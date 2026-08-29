import type {
  ImportAnalyzeRequest,
  ImportAvailabilityDto,
  ImportCommitRequest,
  ImportJobDto,
  ImportQuotaDto,
  ImportSource,
} from "@loomkeep/shared";
import { request } from "./core";

/** Which config-dependent sources are actually usable on this deployment. */
export const getImportAvailability = (): Promise<ImportAvailabilityDto> =>
  request("/import/availability");

/** Per domain, whether this account has already used its one free import in it. */
export const getImportQuota = (): Promise<ImportQuotaDto> =>
  request("/import/quota");

/** Analyse an export → reconciliation plan (writes nothing). Poll the job. */
export const analyzeImport = (
  source: ImportSource,
  body: ImportAnalyzeRequest,
): Promise<ImportJobDto> =>
  request(`/import/${source}/analyze`, { method: "POST", body });

/** Commit an analysed import with the user's reconciliation decisions. */
export const commitImport = (
  source: ImportSource,
  jobId: string,
  body: ImportCommitRequest,
): Promise<ImportJobDto> =>
  request(`/import/${source}/${jobId}/commit`, { method: "POST", body });

/** Poll an import job's progress and, once finished, its plan or report. */
export const getImportJob = (
  source: ImportSource,
  jobId: string,
): Promise<ImportJobDto> => request(`/import/${source}/${jobId}`);
