import { auth } from "#lib/auth.svelte.js";
import { languageName } from "#lib/locales.js";
import { m } from "#lib/paraglide/messages.js";
import { setLocale } from "#lib/paraglide/runtime.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import LandingFooter from "./LandingFooter.svelte";

vi.mock("#lib/paraglide/runtime.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#lib/paraglide/runtime.js")>()),
  setLocale: vi.fn(),
}));

afterEach(() => {
  auth.user = null;
  vi.mocked(setLocale).mockClear();
});

async function chooseItalian() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: languageName("it") }));
}

describe("LandingFooter language picker", () => {
  it("saves the choice on the account when signed in", async () => {
    // initAuth re-applies the account's locale on every load: unsaved, the
    // choice would be undone mid-visit for whatever renders after startup.
    auth.user = { id: "u1", locale: "fr" } as UserDto;
    const saved = vi.fn();
    server.use(
      http.patch(apiUrl("/users/me"), async ({ request }) => {
        const body = (await request.json()) as { locale: string };
        saved(body.locale);
        return HttpResponse.json({ id: "u1", locale: body.locale });
      }),
    );
    renderWithQuery(LandingFooter, {});

    await chooseItalian();

    await waitFor(() => expect(setLocale).toHaveBeenCalledWith("it"));
    expect(saved).toHaveBeenCalledWith("it");
  });

  it("only switches the page language when signed out", async () => {
    renderWithQuery(LandingFooter, {});

    await chooseItalian();

    expect(setLocale).toHaveBeenCalledWith("it");
  });
});

describe("LandingFooter support link", () => {
  // Donations pay for the server, and signed-out visitors had no way to
  // find the platforms.
  it("points to the list of donation platforms", () => {
    renderWithQuery(LandingFooter, {});

    const link = screen.getByRole("link", {
      name: m.landing_footer_link_support(),
    });
    expect(link.getAttribute("href")).toBe(
      "https://github.com/Logan2234/loomkeep#support",
    );
  });
});

describe("LandingFooter catalogue attribution", () => {
  // The landing page shows these providers' artwork to signed-out visitors,
  // and TMDB's API terms require its notice wherever its data appears.
  it("carries TMDB's notice", () => {
    renderWithQuery(LandingFooter, {});

    expect(screen.getByText(m.datasource_tmdb_notice())).toBeTruthy();
  });

  it.each([
    ["TMDB", "https://www.themoviedb.org/"],
    ["AniList", "https://anilist.co/"],
    ["IGDB", "https://www.igdb.com/"],
    ["Open Library", "https://openlibrary.org/"],
    ["MusicBrainz", "https://musicbrainz.org/"],
  ])("credits %s with a link to it", (name, href) => {
    renderWithQuery(LandingFooter, {});

    expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
  });
});
