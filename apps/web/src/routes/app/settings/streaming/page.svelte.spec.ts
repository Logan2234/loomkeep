import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared/contracts";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

let saved: unknown[];

beforeEach(() => {
  saved = [];
  visit("/app/settings/streaming");
  auth.user = {
    id: "u1",
    watchRegion: null,
    watchProviderIds: [],
    listenServices: ["BANDCAMP"],
  } as unknown as UserDto;
  server.use(
    http.get(apiUrl("/catalog/watch-providers"), () =>
      HttpResponse.json({ region: "FR", regions: ["FR"], providers: [] }),
    ),
    http.patch(apiUrl("/users/me"), async ({ request }) => {
      const body = (await request.json()) as { listenServices: string[] };
      saved.push(body);
      return HttpResponse.json({ ...auth.user, ...body });
    }),
  );
});

describe("Streaming settings › music services", () => {
  it("saves a picked service, kept in the album page's order", async () => {
    const user = userEvent.setup();
    renderWithQuery(Page, {});

    const section = screen
      .getByText(m.settings_streaming_music_title())
      .closest("section")!;
    const spotify = within(section).getByRole("button", { name: "Spotify" });
    expect(spotify.getAttribute("aria-pressed")).toBe("false");

    await user.click(spotify);

    await waitFor(() =>
      expect(saved).toEqual([{ listenServices: ["SPOTIFY", "BANDCAMP"] }]),
    );
    expect(spotify.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps only the music half while video is off", async () => {
    auth.user = { ...auth.user!, enabledDomains: ["MUSIC"] } as UserDto;
    let catalogFetched = false;
    server.use(
      http.get(apiUrl("/catalog/watch-providers"), () => {
        catalogFetched = true;
        return HttpResponse.json({ region: "FR", regions: [], providers: [] });
      }),
    );
    renderWithQuery(Page, {});

    expect(screen.getByText(m.settings_streaming_music_title())).toBeTruthy();
    expect(screen.queryByText(m.settings_streaming_region_label())).toBeNull();
    expect(catalogFetched).toBe(false);
  });
});
