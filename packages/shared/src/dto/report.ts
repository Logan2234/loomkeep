import type {
  ModerationLegalBasis,
  ModerationMeasure,
  ReportCategory,
  ReportMotif,
  ReportProfilePart,
  ReportStatus,
  ReportTargetType,
} from "../enums";
import type { UserSummaryDto } from "./social";

export const REPORT_REASON_MAX_LENGTH = 500;
export const REPORT_RESOLUTIONS = ["RESOLVED", "DISMISSED"] as const;
export type ReportResolution = Exclude<ReportStatus, "PENDING">;

export interface ModerationReasonRequestDto {
  reasonText: string;
  legalBasis: ModerationLegalBasis;
  tosClause?: string;
}

/** Minimal display info for whatever a report targets, resolved server-side. */
export interface ReportTargetSummaryDto {
  /** A short excerpt/label — comment text, review text, or a username. */
  label: string;
  href: string | null;
  /** Username of whoever owns the target (comment or review author, reported user, list owner). */
  targetOwnerUsername: string | null;
  /**
   * MESSAGE reports only: the reported message among the few around it in
   * its conversation — moderators have no other way into a private
   * conversation, and its reporter, a member of it, hands them this much.
   */
  context?: ReportContextMessageDto[];
}

export interface ReportContextMessageDto {
  /** Null once the author's account is deleted. */
  authorUsername: string | null;
  /** Null once deleted. */
  text: string | null;
  createdAt: string;
  /** The message the report is about. */
  reported: boolean;
}

export interface ReportDto {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  /** Null on reports filed before the category/motif picker existed. */
  category: ReportCategory | null;
  /** Null for the OTHER category (and on pre-picker reports). */
  motif: ReportMotif | null;
  /** USER reports only: the part of the profile the report is about. */
  profilePart: ReportProfilePart | null;
  reason: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  /** Null once the reporter's account has been deleted — the moderation record stays. */
  reporter: UserSummaryDto | null;
  /** Null if the underlying target was since deleted. */
  target: ReportTargetSummaryDto | null;
}

/** `GET /admin/reports/pending-count` response. */
export interface ReportPendingCountDto {
  count: number;
}

/** `GET /transparency` response: one calendar year of moderation, aggregated for the public page. */
export interface ModerationTransparencyDto {
  year: number;
  /** Every year since the first report or measure, newest first. */
  years: number[];
  reports: {
    total: number;
    withMeasure: number;
    closedWithoutMeasure: number;
    pending: number;
    /** Categories reported at least once, most frequent first. */
    byCategory: { category: ReportCategory; count: number }[];
    /** Over the reports filed this year and already closed; null when none is. */
    medianHandlingHours: number | null;
  };
  measures: {
    total: number;
    /** Measures an admin took on their own initiative, with no report behind them. */
    withoutReport: number;
    byMeasure: { measure: ModerationMeasure; count: number }[];
    byLegalBasis: { legalBasis: ModerationLegalBasis; count: number }[];
  };
}
