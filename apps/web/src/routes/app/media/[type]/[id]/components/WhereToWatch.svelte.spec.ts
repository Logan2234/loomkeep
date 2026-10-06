import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto, WatchProvidersDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import WhereToWatch from "./WhereToWatch.svelte";

const netflix = { id: 8, name: "Netflix", logoUrl: null };
const canal = { id: 381, name: "Canal+", logoUrl: null };
const appleStore = { id: 2, name: "Apple TV Store", logoUrl: null };

const offers: WatchProvidersDto = {
  region: "FR",
  flatrate: [canal, netflix],
  free: [],
  ads: [],
  rent: [],
  buy: [appleStore],
  link: "https://www.themoviedb.org/tv/1396/watch?locale=FR",
};

function signIn(watchProviderIds: number[]) {
  auth.user = { id: "u1", watchProviderIds } as UserDto;
}

function logoNames() {
  return screen
    .getAllByRole("button")
    .filter((button) => button.hasAttribute("aria-expanded"))
    .map((button) => button.getAttribute("aria-label"));
}

describe("where to watch", () => {
  it("puts the user's services first and still lists every offer", () => {
    signIn([8]);

    renderWithQuery(WhereToWatch, { offers });

    expect(logoNames()).toEqual(["Netflix", "Canal+", "Apple TV Store"]);
  });

  it("adds a service to the user's own from its logo", async () => {
    signIn([8]);
    let saved: unknown;
    server.use(
      http.patch(apiUrl("/users/me"), async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ id: "u1", watchProviderIds: [8, 381] });
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(WhereToWatch, { offers });

    await user.click(screen.getByRole("button", { name: "Canal+" }));
    await user.click(
      screen.getByRole("button", { name: m.media_watch_add_mine() }),
    );

    await waitFor(() => expect(saved).toEqual({ watchProviderIds: [8, 381] }));
    expect(logoNames()).toEqual(["Canal+", "Netflix", "Apple TV Store"]);
  });
});
