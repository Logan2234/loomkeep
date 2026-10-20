import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { WorkSearchHitDto } from "@loomkeep/shared";
import { screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import UnifiedSearchPanel from "./UnifiedSearchPanel.svelte";

vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
}));

const hit = (
  kind: WorkSearchHitDto["kind"],
  title: string,
): WorkSearchHitDto => ({
  kind,
  title,
  imageUrl: null,
  href: `/app/${kind}/${title}`,
  year: 2021,
  isAdult: false,
  status: null,
});

describe("UnifiedSearchPanel", () => {
  it("lays the domains out as shelves, in the user's order", async () => {
    server.use(
      http.get(apiUrl("/search/works"), () =>
        HttpResponse.json({
          items: [hit("MOVIE", "Dune"), hit("BOOK", "Dune Messiah")],
          unavailable: [],
        }),
      ),
    );
    const onseeall = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(UnifiedSearchPanel, {
      query: "dune",
      order: ["BOOKS", "MEDIA"],
      onseeall,
    });

    await screen.findByRole("link", { name: "Dune Messiah" });
    const shelves = screen.getAllByRole("region");
    expect(shelves.map((s) => s.getAttribute("aria-labelledby"))).toEqual([
      "shelf-BOOKS",
      "shelf-MEDIA",
    ]);

    await user.click(
      within(shelves[1]).getByRole("button", { name: m.search_see_all() }),
    );
    expect(onseeall).toHaveBeenCalledWith("MEDIA");
  });

  it("says which catalogue didn't answer", async () => {
    server.use(
      http.get(apiUrl("/search/works"), () =>
        HttpResponse.json({
          items: [hit("MOVIE", "Dune")],
          unavailable: ["MUSIC"],
        }),
      ),
    );
    renderWithQuery(UnifiedSearchPanel, {
      query: "dune",
      order: ["MEDIA", "MUSIC"],
      onseeall: () => {},
    });

    expect(
      await screen.findByText(m.search_catalog_unavailable()),
    ).toBeTruthy();
  });
});
