import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { Domain, type UserDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PhoneHome from "./PhoneHome.svelte";

vi.mock("#lib/realtime/socket.js", () => ({
  onRealtimeEvent: () => () => {},
}));

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
});

afterEach(() => {
  auth.user = null;
});

it("starts a new account from one screen", async () => {
  checklist(false);
  renderWithQuery(PhoneHome, {});

  expect(await screen.findByText(m.home_starter_title())).toBeTruthy();
  expect(
    screen.getByRole("link", { name: m.home_starter_search() }),
  ).toBeTruthy();
});

it("shows the phone's own widgets once a first title is in", async () => {
  checklist(true);
  renderWithQuery(PhoneHome, {});

  expect(
    await screen.findByRole("link", { name: new RegExp(m.home_customize()) }),
  ).toBeTruthy();
  expect(screen.queryByText(m.home_starter_title())).toBeNull();
});
