import type { PersonalInvitationDto } from "@loomkeep/shared";
import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { SocialFeatureGuard } from "../social/social-feature.guard";
import type { JwtPayload } from "./decorators/current-user.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { PersonalInvitationResponseDto } from "./dto/personal-invitation-response.dto";
import { InvitationService } from "./invitation.service";

/**
 * A member's own sign-up link (SOC-02). Social only: what it adds to an open
 * instance is that the newcomer and the member follow each other.
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
