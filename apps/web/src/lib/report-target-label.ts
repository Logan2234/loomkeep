// The text shown for a reported item in the admin views (reports queue, a
// user's "reports against" tab). The API flags a deleted target rather than
// wording it, so the admin reads it in their own language.
import { m } from "#lib/paraglide/messages.js";
import type {
  ReportTargetSummaryDto,
  ReportTargetType,
} from "@loomkeep/shared";

export function reportTargetLabel(
  targetType: ReportTargetType,
  target: ReportTargetSummaryDto,
): string {
  const label = !target.deleted
    ? target.label
    : targetType === "MESSAGE"
      ? m.admin_reports_target_message_deleted()
      : m.admin_reports_target_comment_deleted();

  return target.authorDeleted
    ? m.admin_reports_target_author_deleted({ label })
    : label;
}
