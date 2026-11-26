import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { PersonalInvitationAcceptedEvent } from "../auth/auth.events";
import { FollowService } from "./follow.service";
import { isSocialEnabled } from "./social.config";

/**
 * What a personal invitation link adds on a social instance (SOC-02): the
 * member and the newcomer follow each other as soon as the account exists.
 */
@Injectable()
export class InvitationFollowListener {
  constructor(
    private readonly config: ConfigService,
    private readonly follows: FollowService,
  ) {}

  @OnEvent(PersonalInvitationAcceptedEvent.NAME)
  async onPersonalInvitationAccepted(
    event: PersonalInvitationAcceptedEvent,
  ): Promise<void> {
    if (!isSocialEnabled(this.config)) return;
    await this.follows.followEachOther(event.inviterId, event.userId);
  }
}
