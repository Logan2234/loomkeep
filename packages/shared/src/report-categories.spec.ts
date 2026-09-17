import { describe, expect, it } from "vitest";
import {
  isReportCategoryAllowed,
  REPORT_CATEGORY_MOTIFS,
  ReportMotif,
} from "./enums";

describe("isReportCategoryAllowed", () => {
  it("only offers the misleading-review category for reviews", () => {
    expect(isReportCategoryAllowed("MISLEADING_REVIEW", "REVIEW")).toBe(true);
    expect(isReportCategoryAllowed("MISLEADING_REVIEW", "COMMENT")).toBe(false);
  });

  it("offers every general category to comments and reviews alike", () => {
    for (const category of [
      "SPAM",
      "SPOILER",
      "HARASSMENT",
      "OTHER",
    ] as const) {
      expect(isReportCategoryAllowed(category, "COMMENT")).toBe(true);
      expect(isReportCategoryAllowed(category, "REVIEW")).toBe(true);
    }
  });

  it("files an off-topic review under the misleading-review category", () => {
    expect(REPORT_CATEGORY_MOTIFS.MISLEADING_REVIEW).toContain(
      ReportMotif.MISLEADING_REVIEW_OFF_TOPIC,
    );
  });
});
