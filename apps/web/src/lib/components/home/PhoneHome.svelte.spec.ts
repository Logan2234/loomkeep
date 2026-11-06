import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import {
  CatalogSource,
  Domain,
  MediaType,
  type UserDto,
} from "@loomkeep/shared";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PhoneHome from "./PhoneHome.svelte";

vi.mock("#lib/realtime/socket.js", () => ({
  onRealtimeEvent: () => () => {},
}));

const DUNE = {
  source: CatalogSource.TMDB,
  sourceId: "693134",
  type: MediaType.MOVIE,
  title: "Dune: Part Two",
  posterUrl: null,
  year: 2024,
  isAdult: false,
};

function checklist(addedTitle: boolean) {
  server.use(
    http.get(apiUrl("/gamification/onboarding"), () =>
      HttpResponse.json({
        steps: [{ key: "add_title", done: addedTitle, skipped: false }],
        allDone: false,
      }),
    ),
  );
}

beforeEach(() => {
  auth.user = {
    id: "u1",
    username: "alice",
    enabledDomains: [Domain.MEDIA],
    homeLayout: null,
    homePhoneLayout: { widgets: [{ id: "n", type: "note" }] },
  } as unknown as UserDto;
  server.use(
    http.get(apiUrl("/catalog/trending"), () => HttpResponse.json([DUNE])),
  );
});

afterEach(() => {
  auth.user = null;
});

it("starts a new account from one screen, and adds a trending title", async () => {
  checklist(false);
  let added: unknown;
  server.use(
    http.put(apiUrl("/library"), async ({ request }) => {
      added = await request.json();
      return HttpResponse.json({});
    }),
  );
  renderWithQuery(PhoneHome, {});

  expect(await screen.findByText(m.home_starter_title())).toBeTruthy();
  await fireEvent.click(
    await screen.findByRole("button", {
      name: m.home_starter_add({ title: DUNE.title }),
    }),
  );

  await waitFor(() =>
    expect(added).toMatchObject({ sourceId: DUNE.sourceId, status: "PLANNED" }),
  );
});

it("shows the phone's own widgets once a first title is in", async () => {
  checklist(true);
  renderWithQuery(PhoneHome, {});

  expect(
    await screen.findByRole("link", { name: new RegExp(m.home_customize()) }),
  ).toBeTruthy();
  expect(screen.queryByText(m.home_starter_title())).toBeNull();
});
