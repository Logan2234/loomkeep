import { auth } from "#lib/auth.svelte.js";
import { HOME_WIDGETS } from "#lib/home/widgets.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import {
  Domain,
  type HomePhoneLayoutDto,
  type UserDto,
} from "@loomkeep/shared";
import { fireEvent, screen, waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it } from "vitest";
import PhoneHomeEditor from "./PhoneHomeEditor.svelte";

const NOTE = HOME_WIDGETS.note.title();
const MEMORY = HOME_WIDGETS.onThisDay.title();

let saved: HomePhoneLayoutDto[];

function signIn(homePhoneLayout: HomePhoneLayoutDto | null) {
  auth.user = {
    id: "u1",
    username: "alice",
    enabledDomains: [Domain.MEDIA],
    homeLayout: null,
    homePhoneLayout,
  } as unknown as UserDto;
}

beforeEach(() => {
  saved = [];
  server.use(
    http.put(apiUrl("/users/me/home-layout/phone"), async ({ request }) => {
      const body = (await request.json()) as HomePhoneLayoutDto;
      saved.push(body);
      return HttpResponse.json({ ...auth.user, homePhoneLayout: body });
    }),
  );
});

afterEach(() => {
  auth.user = null;
});

it("adds a widget at the end of the phone home and saves it at once", async () => {
  signIn({ widgets: [{ id: "n", type: "note" }] });
  renderWithQuery(PhoneHomeEditor, {});

  await fireEvent.click(
    screen.getByRole("button", { name: `${m.home_editor_add()} : ${MEMORY}` }),
  );

  await waitFor(() => expect(saved).toHaveLength(1));
  expect(saved[0].widgets.map((w) => w.type)).toEqual(["note", "onThisDay"]);
});

it("moves a widget with the arrow keys on its handle", async () => {
  signIn({
    widgets: [
      { id: "n", type: "note" },
      { id: "d", type: "onThisDay" },
    ],
  });
  renderWithQuery(PhoneHomeEditor, {});

  await fireEvent.keyDown(
    screen.getByRole("button", { name: m.home_editor_move({ name: NOTE }) }),
    { key: "ArrowDown" },
  );

  await waitFor(() => expect(saved).toHaveLength(1));
  expect(saved[0].widgets.map((w) => w.id)).toEqual(["d", "n"]);
});

it("keeps the last widget: a phone home is never empty", () => {
  signIn({ widgets: [{ id: "n", type: "note" }] });
  renderWithQuery(PhoneHomeEditor, {});

  expect(
    screen
      .getByRole("button", { name: m.home_editor_remove({ name: NOTE }) })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("never offers the vertical divider, which needs columns", () => {
  signIn({ widgets: [{ id: "n", type: "note" }] });
  renderWithQuery(PhoneHomeEditor, {});

  expect(
    screen.queryByRole("button", {
      name: `${m.home_editor_add()} : ${HOME_WIDGETS.dividerVertical.title()}`,
    }),
  ).toBeNull();
});
