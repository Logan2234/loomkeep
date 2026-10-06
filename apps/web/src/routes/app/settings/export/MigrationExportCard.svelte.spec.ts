import { downloadBlob } from "#lib/download.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import MigrationExportCard from "./MigrationExportCard.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("#lib/download.js", () => ({ downloadBlob: vi.fn() }));

function answer(path: string, names: string[]) {
  const asked: (string | null)[] = [];
  server.use(
    http.get(apiUrl(path), ({ request }) => {
      asked.push(new URL(request.url).searchParams.get("reviews"));
      return HttpResponse.json({
        files: names.map((name) => ({ name, csv: "tmdbID\r\n1" })),
      });
    }),
  );
  return asked;
}

describe("export to another service", () => {
  it("asks for review texts only once the switch is on", async () => {
    const asked = answer("/users/me/export/goodreads", ["goodreads-library"]);
    const user = userEvent.setup();
    renderWithQuery(MigrationExportCard, {});

    await user.click(
      screen.getByRole("switch", { name: m.settings_export_reviews_label() }),
    );
    await user.click(screen.getByRole("button", { name: "Goodreads" }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce());
    expect(asked).toEqual(["true"]);
    expect(vi.mocked(downloadBlob).mock.calls[0][2]).toMatch(
      /^loomkeep-goodreads-library-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it("downloads every Letterboxd file and says how to import them", async () => {
    const asked = answer("/users/me/export/letterboxd", [
      "letterboxd-diary",
      "letterboxd-diary-2",
      "letterboxd-watchlist",
    ]);
    const user = userEvent.setup();
    renderWithQuery(MigrationExportCard, {});

    await user.click(screen.getByRole("button", { name: "Letterboxd" }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(3));
    expect(asked).toEqual(["false"]);
    expect(
      screen.getByText(
        m.settings_export_letterboxd_notice({
          count: 3,
          files: "letterboxd-diary, letterboxd-diary-2, letterboxd-watchlist",
        }),
      ),
    ).toBeTruthy();
  });
});
