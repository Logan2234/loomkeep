import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import { PersonalInvitationAcceptedEvent } from "../auth/auth.events";
import type { FollowService } from "./follow.service";
import { InvitationFollowListener } from "./invitation-follow.listener";

function makeListener(socialEnabled: string | undefined) {
  const config = {
    get: vi.fn((key: string) =>
      key === "SOCIAL_ENABLED" ? socialEnabled : undefined,
    ),
  } as unknown as ConfigService;
  const follows = {
    followEachOther: vi.fn().mockResolvedValue(undefined),
  } as unknown as FollowService;
  return { listener: new InvitationFollowListener(config, follows), follows };
}

describe("InvitationFollowListener", () => {
  it("makes the member and the newcomer follow each other on a social instance", async () => {
    const { listener, follows } = makeListener("true");

    await listener.onPersonalInvitationAccepted(
      new PersonalInvitationAcceptedEvent("alice", "bob"),
    );

    expect(follows.followEachOther).toHaveBeenCalledWith("alice", "bob");
  });

  it("adds no follow when the social features are off", async () => {
    const { listener, follows } = makeListener("false");

    await listener.onPersonalInvitationAccepted(
      new PersonalInvitationAcceptedEvent("alice", "bob"),
    );

    expect(follows.followEachOther).not.toHaveBeenCalled();
  });
});
