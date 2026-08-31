import type {
  ReportCategory,
  ReportMotif,
  ReportStatus,
  ReportTargetType,
} from "../enums";
import type { UserSummaryDto } from "./social";

/** Minimal display info for whatever a report targets, resolved server-side. */
export interface ReportTargetSummaryDto {
  /** A short excerpt/label — comment text, review text, or a username. */
  label: string;
  href: string | null;
  /** Username of whoever owns the target (comment author, reported user, list owner) — null for REVIEW (not wired yet). */
  targetOwnerUsername: string | null;
}

/** One report in the admin moderation queue. */
export interface ReportDto {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  /** Null on reports filed before the category/motif picker existed. */
  category: ReportCategory | null;
  /** Null for the OTHER category (and on pre-picker reports). */
  motif: ReportMotif | null;
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
