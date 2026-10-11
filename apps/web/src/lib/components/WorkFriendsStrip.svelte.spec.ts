import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type {
  UserDto,
  WorkFriendDto,
  WorkFriendsDto,
  WorkProgressDto,
} from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkFriendsStrip from "./WorkFriendsStrip.svelte";

vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  slide: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

const progress = (o: Partial<WorkProgressDto>): WorkProgressDto => ({
  status: "WATCHING",
  season: null,
  episode: null,
  page: null,
  pageCount: null,
  playtimeMinutes: null,
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...o,
});
const friend = (
  username: string,
  o: Partial<WorkFriendDto> = {},
): WorkFriendDto => ({
  ...progress(o),
  user: {
    id: username,
    username,
    displayName: username[0].toUpperCase() + username.slice(1),
    profileAccess: "PUBLIC",
    avatarUrl: null,
  },
  rating: null,
  ...o,
});

function answer(body: WorkFriendsDto) {
  server.use(
    http.get(apiUrl("/social/works/:type/:id/friends"), () =>
      HttpResponse.json(body),
    ),
  );
}

beforeEach(() => {
  auth.user = {
    id: "me",
    username: "bob",
    avatarUrl: null,
  } as unknown as UserDto;
});

afterEach(() => {
  auth.user = null;
});

describe("WorkFriendsStrip", () => {
  it("folds to how many friends and how many are ahead, then shows the season", async () => {
    answer({
      seasons: [9, 10],
      me: progress({ season: 2, episode: 3 }),
      friends: [
        friend("lea", {
          status: "COMPLETED",
          season: 2,
          episode: 10,
          rating: 9,
        }),
        friend("max", { season: 2, episode: 5 }),
        friend("julie", { season: 1, episode: 8 }),
      ],
    });
    const user = userEvent.setup();
    renderWithQuery(WorkFriendsStrip, {
      domain: "MEDIA",
      targetType: "MEDIA",
      targetId: "m1",
    });

    const toggle = await screen.findByRole("button", { expanded: false });
    expect(toggle.textContent).toContain(
      m.work_friends_count_many({ count: 3 }),
    );
    expect(toggle.textContent).toContain(
      m.work_friends_ahead_many({ count: 2 }),
    );

    await user.click(toggle);
    expect(
      screen.getByRole("heading", {
        name: m.work_friends_season({ season: 2, count: 10 }),
      }),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Max · S02E05/)).toBeTruthy();
    expect(screen.getByLabelText(/Lea · .*9\/10/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "S1" }));
    expect(screen.getByLabelText(/Julie · S01E08/)).toBeTruthy();
  });

  it("sorts a game's friends by status", async () => {
    answer({
      seasons: [],
      me: null,
      friends: [
        friend("lea", { status: "COMPLETED" }),
        friend("sam", { status: "BACKLOG" }),
      ],
    });
    const user = userEvent.setup();
    renderWithQuery(WorkFriendsStrip, {
      domain: "GAMES",
      targetType: "GAME",
      targetId: "g1",
    });

    await user.click(await screen.findByRole("button", { expanded: false }));

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("says in words what a single friend did with a game", async () => {
    answer({
      seasons: [],
      me: null,
      friends: [
        friend("lea", {
          status: "COMPLETED",
          playtimeMinutes: 1440,
          rating: 10,
        }),
      ],
    });
    renderWithQuery(WorkFriendsStrip, {
      domain: "GAMES",
      targetType: "GAME",
      targetId: "g1",
    });

    const toggle = await screen.findByRole("button", { expanded: false });
    expect(toggle.textContent).toContain(m.work_friends_did_games_done());
    expect(toggle.textContent).toContain("10/10");
  });

  it("names a few friends and counts them by status", async () => {
    answer({
      seasons: [],
      me: null,
      friends: [
        friend("lea", { status: "COMPLETED" }),
        friend("max", { status: "PLAYING" }),
        friend("sam", { status: "BACKLOG" }),
        friend("nora", { status: "COMPLETED" }),
      ],
    });
    renderWithQuery(WorkFriendsStrip, {
      domain: "GAMES",
      targetType: "GAME",
      targetId: "g1",
    });

    const toggle = await screen.findByRole("button", { expanded: false });
    expect(toggle.textContent).toContain(
      m.work_friends_names_more_many({ first: "Lea", second: "Max", count: 2 }),
    );
    expect(screen.getByLabelText(/: 2$/)).toBeTruthy();
  });

  it("refetches once the viewer's own entry moved", async () => {
    let calls = 0;
    server.use(
      http.get(apiUrl("/social/works/:type/:id/friends"), () => {
        calls += 1;
        return HttpResponse.json({
          seasons: [],
          me: null,
          friends: [friend("lea", { status: "COMPLETED" })],
        });
      }),
    );
    const props = $state({
      domain: "GAMES" as const,
      targetType: "GAME" as const,
      targetId: "g1",
      revision: "BACKLOG:0",
    });
    renderWithQuery(WorkFriendsStrip, props);
    await screen.findByRole("button", { expanded: false });

    props.revision = "PLAYING:60";

    await vi.waitFor(() => expect(calls).toBe(2));
  });

  it("shows nothing when no friend tracks the work", async () => {
    answer({ seasons: [], me: null, friends: [] });
    const { container } = renderWithQuery(WorkFriendsStrip, {
      domain: "MEDIA",
      targetType: "MEDIA",
      targetId: "m1",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector("section")).toBe(null);
  });
});
