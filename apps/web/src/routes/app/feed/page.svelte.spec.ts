import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import FeedPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

afterEach(() => {
  auth.user = null;
});

it("shows enabled planned tabs in domain order without making them selectable", async () => {
  auth.user = {
    enabledDomains: ["MEDIA", "GAMES", "PODCASTS"],
    domainOrder: ["PODCASTS", "GAMES", "MEDIA"],
  } as UserDto;
  server.use(
    http.get(apiUrl("/social/feed"), () =>
      HttpResponse.json({ items: [], hasMore: false }),
    ),
  );
  const { client } = renderWithQuery(FeedPage, {});
  expect(
    screen.getAllByRole("tab").map((tab) => tab.textContent?.trim()),
  ).toEqual([
    m.common_all(),
    m.common_Podcasts(),
    m.common_Games(),
    m.common_Media(),
  ]);
  expect(
    (
      screen.getByRole("tab", {
        name: m.common_Podcasts(),
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(screen.queryByRole("tab", { name: m.common_Boardgames() })).toBeNull();
  await waitFor(() => expect(client.isFetching()).toBe(0));
});
