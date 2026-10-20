import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto, WorkSearchHitDto } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it } from "vitest";
import ListAddWork from "./ListAddWork.svelte";

const hit = (title: string, href: string): WorkSearchHitDto => ({
  kind: "MOVIE",
  title,
  imageUrl: null,
  href,
  year: 2021,
  isAdult: false,
  status: null,
});

let added: unknown[] = [];

beforeEach(() => {
  added = [];
  auth.user = { id: "u1", enabledDomains: ["MEDIA"] } as UserDto;
  server.use(
    http.get(apiUrl("/search/works"), () =>
      HttpResponse.json({
        items: [
          hit("Dune", "/app/media/movie/438631"),
          hit("Dune : Deuxième partie", "/app/media/movie/693134"),
        ],
        unavailable: [],
      }),
    ),
    http.post(apiUrl("/lists/l1/works"), async ({ request }) => {
      added.push(await request.json());
      return HttpResponse.json({ id: "i1" }, { status: 201 });
    }),
  );
});

afterEach(() => {
  auth.user = null;
});

it("adds the highlighted work, then marks it as on the list", async () => {
  const user = userEvent.setup();
  renderWithQuery(ListAddWork, {
    listId: "l1",
    inList: new Set(["/app/media/movie/438631"]),
  });

  await user.type(screen.getByRole("searchbox"), "dune");
  const options = await screen.findAllByRole("option");
  expect(within(options[0]).getByText(m.list_add_work_in_list())).toBeTruthy();

  await user.keyboard("{ArrowDown}{Enter}");

  await waitFor(() =>
    expect(added).toEqual([{ work: "/app/media/movie/693134" }]),
  );
  expect(
    await within(screen.getAllByRole("option")[1]).findByText(
      m.list_add_work_in_list(),
    ),
  ).toBeTruthy();
});
