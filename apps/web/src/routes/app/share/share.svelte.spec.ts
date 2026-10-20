import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { goto, visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import SharePage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

function answer(match: { domain: string | null; href: string } | null) {
  const asked: string[] = [];
  server.use(
    http.get(apiUrl("/links/resolve"), ({ request }) => {
      asked.push(new URL(request.url).searchParams.get("url") ?? "");
      return HttpResponse.json({ match });
    }),
  );
  return asked;
}

describe("share target page", () => {
  it("offers to add the work the shared link points to", async () => {
    const asked = answer({ domain: "GAMES", href: "/app/games/14593" });
    server.use(
      http.get(apiUrl("/games/igdb/14593"), () =>
        HttpResponse.json({
          source: "IGDB",
          sourceId: "14593",
          title: "Hollow Knight",
          year: 2017,
          coverUrl: null,
          developers: ["Team Cherry"],
          entry: null,
        }),
      ),
      http.get(apiUrl("/lists/editable"), () => HttpResponse.json([])),
    );
    visit(
      `/app/share?text=${encodeURIComponent("Regarde https://store.steampowered.com/app/367520/")}`,
    );

    renderWithQuery(SharePage, {});

    expect(
      await screen.findByRole("heading", { name: "Hollow Knight" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: m.quick_add_open() })
        .getAttribute("href"),
    ).toBe("/app/games/14593");
    expect(goto).not.toHaveBeenCalled();
    expect(asked).toEqual(["https://store.steampowered.com/app/367520/"]);
  });

  it("opens any other Loomkeep page the link points to, in place of itself", async () => {
    answer({ domain: null, href: "/app/lists/abc" });
    visit(
      `/app/share?url=${encodeURIComponent("https://loomkeep.app/app/lists/abc")}`,
    );

    renderWithQuery(SharePage, {});

    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/app/lists/abc", {
        replace: true,
      }),
    );
  });

  it("searches for the shared title when the link isn't one it can read", async () => {
    answer(null);
    visit(
      `/app/share?url=${encodeURIComponent("https://letterboxd.com/film/the-matrix/")}&title=The%20Matrix`,
    );

    renderWithQuery(SharePage, {});

    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/app/search?query=The%20Matrix", {
        replace: true,
      }),
    );
  });

  it("says so when there is neither a readable link nor anything to search", async () => {
    answer(null);
    visit(
      `/app/share?url=${encodeURIComponent("https://letterboxd.com/film/the-matrix/")}`,
    );

    renderWithQuery(SharePage, {});

    expect(await screen.findByText(m.share_unrecognized_title())).toBeTruthy();
    expect(goto).not.toHaveBeenCalled();
  });
});
