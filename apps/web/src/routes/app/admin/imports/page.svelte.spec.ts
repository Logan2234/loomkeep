import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { page, visit } from "$lib/test/navigation.svelte";
import { renderWithQuery } from "$lib/test/render";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import Imports from "./+page.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

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

it("shows a retryable summary failure and avoids displaying an empty state for a failed list", async () => {
  visit("/app/admin/imports");
  let summaryFails = true;
  server.use(
    http.get(
      apiUrl("/admin/imports"),
      () => new HttpResponse(null, { status: 503 }),
    ),
    http.get(apiUrl("/admin/imports/summary"), () =>
      summaryFails
        ? new HttpResponse(null, { status: 503 })
        : HttpResponse.json({
            total: 0,
            success: 0,
            failure: 0,
            successPercent: null,
            bySource: [],
          }),
    ),
  );
  renderWithQuery(Imports, {});
  await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
  expect(screen.queryByText(m.admin_no_data())).toBeNull();
  summaryFails = false;
  await userEvent.setup().click(
    within(screen.getAllByRole("alert")[0]).getByRole("button", {
      name: m.common_retry(),
    }),
  );
  await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
  expect(screen.getByText(m.admin_metric_no_sample())).toBeTruthy();
});
