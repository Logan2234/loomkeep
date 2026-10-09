import { m } from "#lib/paraglide/messages.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { RelationshipDto, SocialProfileDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProfileHeader from "./ProfileHeader.svelte";

vi.mock("svelte/transition", () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
}));

const PROFILE = {
  username: "lea",
  displayName: "Léa",
  profileAccess: "PUBLIC",
  avatarUrl: null,
  bio: null,
  followerCount: 3,
  followingCount: 4,
} as unknown as SocialProfileDto;

function renderHeader(rel: Partial<RelationshipDto>, onUnfriend = vi.fn()) {
  renderWithQuery(ProfileHeader, {
    profile: PROFILE,
    rel: {
      isSelf: false,
      following: true,
      requested: false,
      followsYou: false,
      isFriend: false,
      blocking: false,
      ...rel,
    },
    selfManage: false,
    publicView: false,
    busy: false,
    followLabel: m.profile_follow_following(),
    ghostCantFollow: false,
    memberSince: "",
    onToggleFollow: vi.fn(),
    onUnfriend,
    onToggleBlock: vi.fn(),
    onReport: vi.fn(),
    onSignOut: vi.fn(),
    onOpenAvatarZoom: vi.fn(),
    onOpenAvatarModal: vi.fn(),
    onOpenEditProfile: vi.fn(),
    onOpenShareModal: vi.fn(),
    onOpenScanModal: vi.fn(),
    onOpenConnections: vi.fn(),
  });
  return onUnfriend;
}

describe("ProfileHeader", () => {
  it("keeps the follow button for someone who doesn't follow back", () => {
    renderHeader({ following: true, followsYou: false });

    expect(
      screen.getByRole("button", { name: m.profile_follow_following() }),
    ).toBeTruthy();
  });

  // Ending a friendship is rarer than following: it moves to the menu.
  it("puts unfollowing a friend in the menu instead", async () => {
    const user = userEvent.setup();
    const onUnfriend = renderHeader({ following: true, followsYou: true });

    expect(
      screen.queryByRole("button", { name: m.profile_follow_following() }),
    ).toBe(null);

    await user.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: m.profile_unfriend() }),
    );

    expect(onUnfriend).toHaveBeenCalled();
  });
});
