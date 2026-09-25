import type {
  ImportAnalyzeRequest,
  ImportCommitRequest,
  ImportHistoryRunDto,
  ImportSource,
  PagedResult,
} from "@loomkeep/shared";
import { request } from "./core";
import { typedRequest } from "./generated/typed-request";

export const getImportAvailability = () => typedRequest("/import/availability");

export const getImportQuota = () => typedRequest("/import/quota");

export const getLastImportRun = () => typedRequest("/import/last-run");

export const getImportHistory = (page: number) =>
  request<PagedResult<ImportHistoryRunDto>>(`/import/history?page=${page}`);

export const analyzeImport = (
  source: ImportSource,
  body: ImportAnalyzeRequest,
) =>
  typedRequest("/import/{source}/analyze", {
    method: "POST",
    params: { source },
    body,
  });

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

export const getImportJob = (source: ImportSource, jobId: string) =>
  typedRequest("/import/{source}/{jobId}", { params: { source, jobId } });
