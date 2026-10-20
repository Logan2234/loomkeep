import {
  summarizeMeasures,
  summarizeReports,
  type TransparencyReportRow,
  transparencyYears,
} from "./transparency.util";

const HOUR = 60 * 60 * 1000;

function report(
  overrides: Partial<TransparencyReportRow> = {},
): TransparencyReportRow {
  return {
    category: "SPAM",
    status: "PENDING",
    createdAt: new Date("2026-03-01T10:00:00Z"),
    resolvedAt: null,
    decisionCount: 0,
    ...overrides,
  };
}

describe("transparencyYears", () => {
  it("lists every year since the first one, newest first", () => {
    expect(transparencyYears(2028, 2026)).toEqual([2028, 2027, 2026]);
  });

  it("offers only the current year when nothing was ever reported", () => {
    expect(transparencyYears(2026, null)).toEqual([2026]);
  });
});

describe("summarizeReports", () => {
  it("tells reports followed by a measure from those closed without one", () => {
    const summary = summarizeReports([
      // RESOLVED without a decision: the admin closed it with no measure.
      report({ status: "RESOLVED", resolvedAt: new Date() }),
      report({ status: "RESOLVED", resolvedAt: new Date(), decisionCount: 1 }),
      report({ status: "DISMISSED", resolvedAt: new Date() }),
      report(),
    ]);

    expect(summary).toMatchObject({
      total: 4,
      withMeasure: 1,
      closedWithoutMeasure: 2,
      pending: 1,
    });
  });

  it("ranks categories by count and files uncategorized reports under OTHER", () => {
    const summary = summarizeReports([
      report({ category: null }),
      report({ category: "SPOILER" }),
      report({ category: "SPOILER" }),
    ]);

    expect(summary.byCategory).toEqual([
      { category: "SPOILER", count: 2 },
      { category: "OTHER", count: 1 },
    ]);
  });

  it("takes the median handling time over closed reports only", () => {
    const createdAt = new Date("2026-03-01T10:00:00Z");
    const closedAfter = (hours: number) =>
      report({
        status: "DISMISSED",
        createdAt,
        resolvedAt: new Date(createdAt.getTime() + hours * HOUR),
      });

    const summary = summarizeReports([
      closedAfter(2),
      closedAfter(10),
      closedAfter(300),
      report(),
    ]);

    expect(summary.medianHandlingHours).toBe(10);
    expect(summarizeReports([report()]).medianHandlingHours).toBeNull();
  });
});

describe("summarizeMeasures", () => {
  it("lists every measure and legal basis, even at zero", () => {
    const summary = summarizeMeasures([
      {
        measure: "COMMENT_REMOVED",
        legalBasis: "TOS_BREACH",
        reportId: "r1",
      },
      {
        measure: "ACCOUNT_DELETED",
        legalBasis: "ILLEGAL_CONTENT",
        reportId: null,
      },
    ]);

    expect(summary).toEqual({
      total: 2,
      withoutReport: 1,
      byMeasure: [
        { measure: "COMMENT_REMOVED", count: 1 },
        { measure: "MESSAGE_REMOVED", count: 0 },
        { measure: "REVIEW_REMOVED", count: 0 },
        { measure: "LIST_REMOVED", count: 0 },
        { measure: "LIST_EDITED", count: 0 },
        { measure: "AVATAR_REMOVED", count: 0 },
        { measure: "BIO_CLEARED", count: 0 },
        { measure: "DISPLAY_NAME_CHANGED", count: 0 },
        { measure: "ACCOUNT_SUSPENDED", count: 0 },
        { measure: "ACCOUNT_DELETED", count: 1 },
      ],
      byLegalBasis: [
        { legalBasis: "ILLEGAL_CONTENT", count: 1 },
        { legalBasis: "TOS_BREACH", count: 1 },
      ],
    });
  });
});
