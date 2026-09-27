import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { goto, visit } from "$lib/test/navigation.svelte";
import { renderWithQuery } from "$lib/test/render";
import { screen, waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import SharePage from "./+page.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

function answer(match: { domain: string; href: string } | null) {
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
  it("opens the work the shared link points to, in place of itself", async () => {
    const asked = answer({ domain: "GAMES", href: "/app/games/14593" });
    visit(
      `/app/share?text=${encodeURIComponent("Regarde https://store.steampowered.com/app/367520/")}`,
    );

    renderWithQuery(SharePage, {});

    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/app/games/14593", {
        replaceState: true,
      }),
    );
    expect(asked).toEqual(["https://store.steampowered.com/app/367520/"]);
  });

  it("searches for the shared title when the link isn't one it can read", async () => {
    answer(null);
    visit(
      `/app/share?url=${encodeURIComponent("https://letterboxd.com/film/the-matrix/")}&title=The%20Matrix`,
    );

    renderWithQuery(SharePage, {});

    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/app/search?query=The%20Matrix", {
        replaceState: true,
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
