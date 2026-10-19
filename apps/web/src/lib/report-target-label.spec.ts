import { m } from "#lib/paraglide/messages.js";
import type { ReportTargetSummaryDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { reportTargetLabel } from "./report-target-label";

const target = (
  overrides: Partial<ReportTargetSummaryDto>,
): ReportTargetSummaryDto => ({
  label: "Spoiler: he dies",
  deleted: false,
  authorDeleted: false,
  href: null,
  targetOwnerUsername: null,
  ...overrides,
});

describe("reportTargetLabel", () => {
  it("shows the excerpt as is while the target exists", () => {
    expect(reportTargetLabel("COMMENT", target({}))).toBe("Spoiler: he dies");
  });

  it("words a deleted comment or message in the viewer's language", () => {
    expect(
      reportTargetLabel("COMMENT", target({ label: "", deleted: true })),
    ).toBe(m.admin_reports_target_comment_deleted());
    expect(
      reportTargetLabel("MESSAGE", target({ label: "", deleted: true })),
    ).toBe(m.admin_reports_target_message_deleted());
  });

  it("marks a review whose author deleted their account", () => {
    expect(
      reportTargetLabel(
        "REVIEW",
        target({ label: "2/10", authorDeleted: true }),
      ),
    ).toBe(m.admin_reports_target_author_deleted({ label: "2/10" }));
  });
});
