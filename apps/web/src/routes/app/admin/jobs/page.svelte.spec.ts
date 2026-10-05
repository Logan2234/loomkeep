import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import Jobs from "./+page.svelte";

vi.mock("#lib/auth.svelte.js", () => ({
  auth: { isAdmin: true, user: null, clear: vi.fn() },
}));

it("shows compact job cards with server timing and only blocks the running job", async () => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const launched = vi.fn();
  const jobs = [
    {
      key: "notifications.scan",
      runs: Array.from({ length: 50 }, (_, index) => ({
        id: `run-${index}`,
        jobKey: "notifications.scan",
        startedAt: "2026-10-04T13:00:00Z",
        finishedAt: "2026-10-04T13:00:00.306Z",
        status: index < 10 ? "FAILURE" : "SUCCESS",
        summary: index < 10 ? null : "Nothing new",
        error: index < 10 ? "Failed" : null,
      })),
      timeZone: "Europe/Paris",
      nextRunAt: "2026-10-04T14:00:00Z",
      overdueSince: null,
      runningSince: null,
    },
    {
      key: "backup.run",
      runs: [],
      timeZone: "Europe/Paris",
      nextRunAt: "2026-10-05T01:00:00Z",
      overdueSince: "2026-10-04T12:00:00Z",
      runningSince: "2026-10-04T13:02:00Z",
    },
  ];
  server.use(
    http.get(apiUrl("/admin/jobs"), () => HttpResponse.json({ jobs })),
    http.post(apiUrl("/admin/jobs/notifications.scan/run"), () => {
      launched();
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const { container } = renderWithQuery(Jobs, {});
  expect(
    await screen.findByRole("heading", {
      name: m.admin_job_notifications_scan(),
    }),
  ).toBeTruthy();
  const nav = screen.getByRole("navigation", {
    name: m.admin_jobs_section_navigation(),
  });
  expect(
    within(nav)
      .getByRole("link", { name: m.admin_job_backup() })
      .getAttribute("href"),
  ).toBe("#job-backup.run");
  expect(
    within(nav).getByTitle(m.common_failure()).classList.contains("bg-danger"),
  ).toBe(true);
  expect(nav.querySelector(".bg-warning[title]")).toBeTruthy();
  expect(
    screen.getByText(m.admin_jobs_time_zone({ zone: "Europe/Paris" }), {
      exact: false,
    }),
  ).toBeTruthy();
  const cards = container.querySelectorAll("section.card");
  expect(cards).toHaveLength(2);
  expect(within(cards[0] as HTMLElement).getByText("20 %")).toBeTruthy();
  expect(
    within(cards[1] as HTMLElement).getByRole("button", {
      name: m.admin_jobs_running(),
    }),
  ).toHaveProperty("disabled", true);
  const first = within(cards[0] as HTMLElement);
  await userEvent
    .setup()
    .click(first.getByRole("button", { name: m.admin_jobs_run_now() }));
  await vi.waitFor(() => expect(launched).toHaveBeenCalledOnce());
  await userEvent
    .setup()
    .click(
      first.getByRole("button", { name: m.admin_jobs_history({ count: 50 }) }),
    );
  await vi.waitFor(() =>
    expect(
      first
        .getByRole("button", { name: m.admin_jobs_history({ count: 50 }) })
        .getAttribute("aria-expanded"),
    ).toBe("true"),
  );
  expect(
    within(
      document.getElementById("job-history-notifications.scan")!,
    ).getAllByText("Failed"),
  ).toHaveLength(10);
  vi.unstubAllGlobals();
});
