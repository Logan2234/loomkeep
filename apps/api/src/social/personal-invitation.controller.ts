import type { PersonalInvitationDto } from "@loomkeep/shared/contracts";
import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PersonalInvitationResponseDto } from "../auth/dto/personal-invitation-response.dto";
import { InvitationService } from "../auth/invitation.service";
import { SocialFeatureGuard } from "./social-feature.guard";

/**
 * A member's own sign-up link (SOC-02). Social only: what it adds to an open
 * instance is that the newcomer and the member follow each other
 * (InvitationFollowListener). The links themselves are the auth module's.
 */
@UseGuards(SocialFeatureGuard)
@Controller("users/me/invitation")
export class PersonalInvitationController {
  constructor(private readonly invitations: InvitationService) {}

  @Get()
  @ApiOkResponse({ type: PersonalInvitationResponseDto })
  get(@CurrentUser() payload: JwtPayload): Promise<PersonalInvitationDto> {
    return this.invitations.personalLink(payload.sub);
  }

  /** Replaces the link: the one already shared stops working. */
  @Post("renew")
  @ApiCreatedResponse({ type: PersonalInvitationResponseDto })
  renew(@CurrentUser() payload: JwtPayload): Promise<PersonalInvitationDto> {
    return this.invitations.renewPersonalLink(payload.sub);
  }
}
