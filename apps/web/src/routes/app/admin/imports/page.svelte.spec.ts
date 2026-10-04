import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { page, visit } from "$lib/test/navigation.svelte";
import { renderWithQuery } from "$lib/test/render";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import Imports from "./+page.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

beforeEach(() =>
  server.use(
    http.get(apiUrl("/admin/users/options"), () =>
      HttpResponse.json({ items: [], hasMore: false }),
    ),
  ),
);

it("restores URL filters and clears an empty filtered list", async () => {
  visit("/app/admin/imports?status=FAILURE");
  const statuses: (string | null)[] = [];
  server.use(
    http.get(apiUrl("/admin/imports"), ({ request }) => {
      statuses.push(new URL(request.url).searchParams.get("status"));
      return HttpResponse.json({ items: [], hasMore: false });
    }),
    http.get(apiUrl("/admin/imports/summary"), () =>
      HttpResponse.json({
        total: 0,
        success: 0,
        failure: 0,
        successPercent: null,
        bySource: [],
      }),
    ),
  );
  renderWithQuery(Imports, {});
  await screen.findByText(m.admin_no_matches());
  expect(statuses).toEqual(["FAILURE"]);
  await userEvent
    .setup()
    .click(screen.getAllByRole("button", { name: m.admin_filters_reset() })[0]);
  await waitFor(() => expect(page.url.searchParams.has("status")).toBe(false));
  await screen.findByText(m.admin_no_data());
});

it("shows read failures without offering to retry an import", async () => {
  visit("/app/admin/imports");

  server.use(
    http.get(apiUrl("/admin/users/options"), () =>
      HttpResponse.json({ items: [], hasMore: false }),
    ),
    http.get(
      apiUrl("/admin/imports"),
      () => new HttpResponse(null, { status: 503 }),
    ),
    http.get(
      apiUrl("/admin/imports/summary"),
      () => new HttpResponse(null, { status: 503 }),
    ),
  );
  renderWithQuery(Imports, {});
  await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
  expect(screen.queryByText(m.admin_no_data())).toBeNull();
  expect(
    screen.queryAllByRole("button", { name: m.common_retry() }),
  ).toHaveLength(0);
});

it("passes inclusive date filters, displays ongoing imports, and opens their details", async () => {
  visit("/app/admin/imports?status=RUNNING&from=2026-10-01&to=2026-10-04");
  const requests: URL[] = [];
  const run = {
    id: "active",
    userId: "u1",
    identifier: "test@example.com",
    sourceId: "tvtime",
    status: "RUNNING",
    itemCount: 0,
    overwrite: true,
    summary: null,
    error: null,
    startedAt: "2026-10-04T10:00:00Z",
    finishedAt: null,
    progress: { done: 2, total: 3 },
  };
  server.use(
    http.get(apiUrl("/admin/users/options"), () =>
      HttpResponse.json({ items: [], hasMore: false }),
    ),
    http.get(apiUrl("/admin/imports/summary"), () =>
      HttpResponse.json({
        total: 0,
        success: 0,
        failure: 0,
        successPercent: null,
        bySource: [],
      }),
    ),
    http.get(apiUrl("/admin/imports"), ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ items: [run], hasMore: false });
    }),
    http.get(apiUrl("/admin/imports/active"), () =>
      HttpResponse.json({
        ...run,
        details: {
          items: [
            { title: "Selected movie", state: "selected" },
            { title: "Ignored movie", state: "ignored" },
          ],
          report: null,
        },
      }),
    ),
  );
  renderWithQuery(Imports, {});
  await screen.findByText(m.admin_imports_progress({ done: 2, total: 3 }));
  const from = new Date("2026-10-01T00:00:00");
  const to = new Date("2026-10-05T00:00:00");
  expect(requests[0].searchParams.get("from")).toBe(from.toISOString());
  expect(requests[0].searchParams.get("to")).toBe(to.toISOString());
  expect(requests[0].searchParams.get("status")).toBe("RUNNING");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: m.admin_imports_details() }));
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText("Selected movie")).toBeTruthy();
  const tabs = within(dialog).getByRole("tablist", { name: m.common_status() });
  expect(
    within(tabs)
      .getByRole("tab", { name: m.admin_imports_selected() + " (1)" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  await userEvent.setup().click(
    within(tabs).getByRole("tab", {
      name: m.admin_imports_ignored() + " (1)",
    }),
  );
  expect(
    within(tabs)
      .getByRole("tab", { name: m.admin_imports_ignored() + " (1)" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(within(dialog).getByRole("tabpanel").textContent).toContain(
    "Ignored movie",
  );
});

it("labels an active analysis without presenting it as a committed import", async () => {
  visit("/app/admin/imports");
  const analysis = {
    id: "analysis",
    userId: "u1",
    identifier: "test@example.com",
    sourceId: "tvtime",
    status: "RUNNING",
    phase: "analyze",
    itemCount: 0,
    overwrite: false,
    summary: null,
    error: null,
    startedAt: "2026-10-04T10:00:00Z",
    finishedAt: null,
    progress: { done: 0, total: 0 },
  };
  server.use(
    http.get(apiUrl("/admin/imports/summary"), () =>
      HttpResponse.json({
        total: 0,
        success: 0,
        failure: 0,
        successPercent: null,
        bySource: [],
      }),
    ),
    http.get(apiUrl("/admin/imports"), () =>
      HttpResponse.json({ items: [analysis], hasMore: false }),
    ),
    http.get(apiUrl("/admin/imports/analysis"), () =>
      HttpResponse.json({ ...analysis, details: null }),
    ),
  );
  renderWithQuery(Imports, {});
  await screen.findByText(m.import_analyzing());
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: m.admin_imports_details() }));
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getAllByText(m.import_analyzing()).length,
  ).toBeGreaterThan(0);
  expect(
    within(dialog).queryByText(m.admin_imports_legacy_details()),
  ).toBeNull();
});
