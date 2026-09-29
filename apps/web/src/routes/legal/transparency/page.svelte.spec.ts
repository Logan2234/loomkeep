import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import { ErrorCode, type ModerationTransparencyDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import TransparencyPage from "./+page.svelte";

function transparency(
  year: number,
  overrides: Partial<ModerationTransparencyDto> = {},
): ModerationTransparencyDto {
  return {
    year,
    years: [2027, 2026],
    reports: {
      total: 3,
      withMeasure: 1,
      closedWithoutMeasure: 1,
      pending: 1,
      byCategory: [{ category: "SPOILER", count: 3 }],
      medianHandlingHours: 19,
    },
    measures: {
      total: 2,
      withoutReport: 1,
      byMeasure: [
        { measure: "COMMENT_REMOVED", count: 1 },
        { measure: "REVIEW_REMOVED", count: 0 },
        { measure: "ACCOUNT_DELETED", count: 1 },
      ],
      byLegalBasis: [
        { legalBasis: "ILLEGAL_CONTENT", count: 0 },
        { legalBasis: "TOS_BREACH", count: 2 },
      ],
    },
    ...overrides,
  };
}

const EMPTY_YEAR: Partial<ModerationTransparencyDto> = {
  reports: {
    total: 0,
    withMeasure: 0,
    closedWithoutMeasure: 0,
    pending: 0,
    byCategory: [],
    medianHandlingHours: null,
  },
  measures: {
    total: 0,
    withoutReport: 0,
    byMeasure: [],
    byLegalBasis: [],
  },
};

describe("/legal/transparency", () => {
  it("shows the current year's figures, then another year on demand", async () => {
    server.use(
      http.get(apiUrl("/transparency"), ({ request }) => {
        const year = new URL(request.url).searchParams.get("year");
        return HttpResponse.json(
          year === "2026" ? transparency(2026, EMPTY_YEAR) : transparency(2027),
        );
      }),
    );
    renderWithQuery(TransparencyPage, {});

    expect(
      await screen.findByText(
        `${m.transparency_reports_total_many({ count: 3, year: 2027 })} ${m.transparency_median({ duration: m.transparency_duration_hours({ count: 19 }) })}`,
      ),
    ).toBeTruthy();
    expect(screen.getByText(m.transparency_measure_account())).toBeTruthy();
    expect(
      screen.getByText(m.transparency_appeal_terms_link()).getAttribute("href"),
    ).toBe("/legal/terms-of-service#moderation");

    await userEvent.click(screen.getByRole("button", { name: "2026" }));

    expect(
      await screen.findByText(m.transparency_empty_title({ year: 2026 })),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "2026" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("hides the year picker while there is only one year", async () => {
    server.use(
      http.get(apiUrl("/transparency"), () =>
        HttpResponse.json(transparency(2026, { years: [2026] })),
      ),
    );
    renderWithQuery(TransparencyPage, {});

    await screen.findByText(m.transparency_reports_heading());
    expect(screen.queryByRole("button", { name: "2026" })).toBeNull();
  });

  it("says the instance publishes nothing when social is off", async () => {
    server.use(
      http.get(apiUrl("/transparency"), () =>
        HttpResponse.json(
          { code: ErrorCode.SocialFeatureDisabled, message: "Not found" },
          { status: 404 },
        ),
      ),
    );
    renderWithQuery(TransparencyPage, {});

    expect(await screen.findByText(m.transparency_unavailable())).toBeTruthy();
  });
});
