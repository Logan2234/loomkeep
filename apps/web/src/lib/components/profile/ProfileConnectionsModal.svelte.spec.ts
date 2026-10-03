import { auth } from "$lib/auth.svelte";
import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type { ConnectionDto, UserDto } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfileConnectionsModal from "./ProfileConnectionsModal.svelte";

function person(
  username: string,
  displayName: string,
  rel: Partial<
    Pick<ConnectionDto, "following" | "requested" | "isFriend">
  > = {},
): ConnectionDto {
  return {
    id: username,
    username,
    displayName,
    profileAccess: "PUBLIC",
    avatarUrl: null,
    following: false,
    requested: false,
    isFriend: false,
    ...rel,
  };
}

const relationship = (following: boolean) => ({
  isSelf: false,
  following,
  requested: false,
  followsYou: true,
  isFriend: following,
  blocking: false,
});

const calls = {
  follow: vi.fn(),
  unfollow: vi.fn(),
  removeFollower: vi.fn(),
};

beforeEach(() => {
  auth.user = { id: "me", username: "bob" } as UserDto;
  Object.values(calls).forEach((fn) => fn.mockClear());
  server.use(
    http.get(apiUrl("/social/users/bob/followers"), () =>
      HttpResponse.json([
        person("camille", "Camille Roux", { following: true, isFriend: true }),
        person("jules", "Jules Fabre"),
      ]),
    ),
    http.get(apiUrl("/social/users/bob/following"), () =>
      HttpResponse.json([
        person("camille", "Camille Roux", { following: true, isFriend: true }),
      ]),
    ),
    http.post(apiUrl("/social/users/:username/follow"), ({ params }) => {
      calls.follow(params.username);
      return HttpResponse.json(relationship(true));
    }),
    http.delete(apiUrl("/social/users/:username/follow"), ({ params }) => {
      calls.unfollow(params.username);
      return HttpResponse.json(relationship(false));
    }),
    http.delete(apiUrl("/social/users/:username/follower"), ({ params }) => {
      calls.removeFollower(params.username);
      return HttpResponse.json(relationship(false));
    }),
    http.get(apiUrl("/social/users/bob"), () => HttpResponse.json({})),
  );
});

afterEach(() => {
  auth.user = null;
});

function renderModal(kind: "followers" | "following") {
  renderWithQuery(ProfileConnectionsModal, {
    username: "bob",
    kind,
    followerCount: 2,
    followingCount: 1,
    manage: true,
    onClose: vi.fn(),
  });
  return userEvent.setup();
}

const row = (name: string) => screen.getByText(name).closest("li")!;

describe("ProfileConnectionsModal on your own profile", () => {
  it("follows back a follower, who then shows as a friend", async () => {
    const user = renderModal("followers");
    await screen.findByText("Jules Fabre");

    expect(
      within(row("Camille Roux")).getByText(m.profile_connections_friend()),
    ).toBeTruthy();

    await user.click(
      within(row("Jules Fabre")).getByRole("button", {
        name: m.profile_connections_follow_back(),
      }),
    );

    await waitFor(() =>
      expect(
        within(row("Jules Fabre")).getByText(m.profile_connections_friend()),
      ).toBeTruthy(),
    );
    expect(calls.follow).toHaveBeenCalledWith("jules");
  });

  it("removes a follower after confirming, without unfollowing them", async () => {
    const user = renderModal("followers");
    await screen.findByText("Jules Fabre");

    await user.click(
      within(row("Jules Fabre")).getByRole("button", {
        name: m.profile_connections_remove({ name: "Jules Fabre" }),
      }),
    );
    expect(calls.removeFollower).not.toHaveBeenCalled();

    await user.click(
      within(row("Jules Fabre")).getByRole("button", {
        name: m.common_remove(),
      }),
    );

    await waitFor(() =>
      expect(calls.removeFollower).toHaveBeenCalledWith("jules"),
    );
    expect(calls.unfollow).not.toHaveBeenCalled();
  });

  it("says unfollow on the following tab, and offers to follow again", async () => {
    const user = renderModal("following");
    await screen.findByText("Camille Roux");

    await user.click(
      within(row("Camille Roux")).getByRole("button", {
        name: m.profile_connections_unfollow(),
      }),
    );

    await waitFor(() =>
      expect(
        within(row("Camille Roux")).getByRole("button", {
          name: m.common_follow(),
        }),
      ).toBeTruthy(),
    );
    expect(calls.unfollow).toHaveBeenCalledWith("camille");
  });
});
