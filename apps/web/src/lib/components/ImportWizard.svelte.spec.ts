import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import {
  Domain,
  ErrorCode,
  type ImportCommitRequest,
  type ImportJobDto,
  type ImportPlan,
} from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importJobError } from "./import-presentation";
import ImportWizard from "./ImportWizard.svelte";

// Progress ticks arrive over the socket in the app; here every job is
// already settled on its first poll, so the socket only needs to exist.
vi.mock("$lib/realtime/socket", () => ({
  socket: { on: vi.fn(), off: vi.fn() },
  onRealtimeEvent: vi.fn(() => () => {}),
}));

const PLAN: ImportPlan = {
  groups: [
    {
      id: "READ",
      label: "Read",
      items: [
        {
          key: "dune",
          title: "Dune",
          sourceTitle: "Dune",
          subtitle: null,
          coverUrl: null,
          match: {
            source: "OPEN_LIBRARY",
            sourceId: "OL1W",
            title: "Dune",
            year: 1965,
            coverUrl: null,
          },
          include: true,
          alreadyInLibrary: false,
          defaultStatus: "READ",
        },
        {
          key: "hyperion",
          title: "Hyperion (Cantos)",
          sourceTitle: "Hyperion (Cantos)",
          subtitle: null,
          coverUrl: null,
          match: null,
          include: false,
          alreadyInLibrary: false,
          defaultStatus: "READ",
        },
      ],
    },
  ],
  counts: { total: 2, matched: 1, unresolved: 1, apiErrors: 0 },
  searchDomain: Domain.BOOKS,
};

const job = (id: string, extra: Partial<ImportJobDto>): ImportJobDto => ({
  id,
  status: "completed",
  progress: { done: 2, total: 2 },
  plan: null,
  report: null,
  error: null,
  ...extra,
});

const running = (id: string) =>
  job(id, { status: "running", progress: { done: 0, total: 2 } });

let commitBody: ImportCommitRequest | null;

/** The API side of a successful analyze → commit round trip. */
function serveImport(analysis: ImportJobDto = job("analysis", { plan: PLAN })) {
  server.use(
    http.post(apiUrl("/import/goodreads/analyze"), () =>
      HttpResponse.json(running(analysis.id)),
    ),
    http.get(apiUrl(`/import/goodreads/${analysis.id}`), () =>
      HttpResponse.json(analysis),
    ),
    http.post(
      apiUrl(`/import/goodreads/${analysis.id}/commit`),
      async ({ request }) => {
        commitBody = (await request.json()) as ImportCommitRequest;
        return HttpResponse.json(running("commit"));
      },
    ),
    http.get(apiUrl("/import/goodreads/commit"), () =>
      HttpResponse.json(
        job("commit", {
          report: {
            overwrite: false,
            tiles: [{ id: "READ", label: "Read", value: 1, sub: null }],
          },
        }),
      ),
    ),
  );
}

async function analyzeExport() {
  const user = userEvent.setup();
  renderWithQuery(ImportWizard, { source: "goodreads" });

  const analyze = screen.getByRole<HTMLButtonElement>("button", {
    name: m.common_analyze(),
  });
  expect(analyze.disabled).toBe(true);

  await user.upload(
    document.querySelector<HTMLInputElement>('input[type="file"]')!,
    new File(["Title,Author\nDune,Frank Herbert\n"], "goodreads.csv", {
      type: "text/csv",
    }),
  );
  await waitFor(() => expect(analyze.disabled).toBe(false));
  await user.click(analyze);

  return user;
}

beforeEach(() => {
  commitBody = null;
  server.use(http.get(apiUrl("/import/quota"), () => HttpResponse.json({})));
});

describe("ImportWizard", () => {
  it("imports the reviewed selection and reports the outcome", async () => {
    serveImport();
    const user = await analyzeExport();

    expect(await screen.findByText("Dune")).toBeTruthy();
    // Only the automatically matched item starts selected; the other one
    // waits for a manual match.
    expect(
      screen.getByText(m.import_unmatched_count({ count: 1 })),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: m.common_import_action() }),
    );

    expect(await screen.findByText(m.import_completed_title())).toBeTruthy();
    expect(commitBody).toEqual({
      include: ["dune"],
      statuses: { dune: "READ" },
      overrides: {},
      overwrite: false,
    });
  });

  it("imports an item the user matched by hand", async () => {
    serveImport();
    server.use(
      http.get(apiUrl("/books/search"), ({ request }) => {
        expect(new URL(request.url).searchParams.get("q")).toBe(
          "Hyperion (Cantos)",
        );
        return HttpResponse.json({
          results: [
            {
              source: "OPEN_LIBRARY",
              sourceId: "OL2W",
              title: "Hyperion",
              year: 1989,
              coverUrl: null,
            },
          ],
        });
      }),
    );
    const user = await analyzeExport();
    await screen.findByText("Dune");

    await user.click(screen.getByRole("button", { name: m.import_match() }));
    await user.click(
      screen.getByRole("button", { name: m.common_search_action() }),
    );
    await user.click(await screen.findByRole("button", { name: /Hyperion/ }));

    await waitFor(() =>
      expect(
        screen.queryByText(m.import_unmatched_count({ count: 1 })),
      ).toBeNull(),
    );
    await user.click(
      screen.getByRole("button", { name: m.common_import_action() }),
    );

    await screen.findByText(m.import_completed_title());
    expect(commitBody?.include).toEqual(["dune", "hyperion"]);
    expect(commitBody?.overrides).toEqual({
      hyperion: { source: "OPEN_LIBRARY", sourceId: "OL2W" },
    });
  });

  it("asks for confirmation before replacing the library", async () => {
    serveImport();
    const user = await analyzeExport();
    await screen.findByText("Dune");

    await user.click(
      screen.getByRole("checkbox", { name: m.import_overwrite_data() }),
    );
    await user.click(
      screen.getByRole("button", { name: m.common_import_action() }),
    );

    expect(await screen.findByText(m.import_overwrite_title())).toBeTruthy();
    expect(commitBody).toBeNull();

    await user.click(
      screen.getByRole("button", { name: m.import_overwrite_confirm() }),
    );

    await screen.findByText(m.import_completed_title());
    expect(commitBody?.overwrite).toBe(true);
  });

  it("returns to the upload step when the analysis fails", async () => {
    const failed = job("analysis", {
      status: "failed",
      errorCode: ErrorCode.ImportMalformedExport,
    });
    serveImport(failed);
    await analyzeExport();

    expect(await screen.findByText(importJobError(failed))).toBeTruthy();
    expect(
      screen.getByRole("button", { name: m.common_analyze() }),
    ).toBeTruthy();
  });
});
