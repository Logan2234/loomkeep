import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { CastDetailDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import CastSection from "./CastSection.svelte";

const detail: CastDetailDto = {
  name: "Zendaya",
  photoUrl: null,
  subtitle: "1996 · Oakland",
  description: "Actrice et chanteuse américaine.",
  imdbId: null,
  wikidataId: null,
  homepage: null,
  knownFor: [],
};

describe("CastSection", () => {
  it("links a TMDB cast member's dialog to their page", async () => {
    server.use(
      http.get(apiUrl("/catalog/tmdb/person/505710"), () =>
        HttpResponse.json(detail),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(CastSection, {
      source: "tmdb",
      cast: [{ id: "505710", name: "Zendaya", role: "Chani", photoUrl: null }],
    });

    await user.click(screen.getByRole("button", { name: /Zendaya/ }));

    const link = await screen.findByRole("link", {
      name: m.creator_see_page(),
    });
    expect(link.getAttribute("href")).toBe("/app/people/tmdb/505710");
  });

  it("offers no page for an AniList voice actor yet", async () => {
    server.use(
      http.get(apiUrl("/catalog/anilist/person/95185"), () =>
        HttpResponse.json({ ...detail, name: "Atsumi Tanezaki" }),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(CastSection, {
      source: "anilist",
      cast: [
        {
          id: "95185",
          name: "Atsumi Tanezaki",
          role: "Frieren",
          photoUrl: null,
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: /Atsumi Tanezaki/ }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: m.creator_see_page() }),
    ).toBeNull();
  });
});
