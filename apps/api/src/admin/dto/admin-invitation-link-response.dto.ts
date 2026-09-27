import type { AdminInvitationLinkDto } from "@loomkeep/shared";
import { AdminInvitationResponseDto } from "./admin-invitation-response.dto";

export class AdminInvitationLinkResponseDto implements AdminInvitationLinkDto {
  invitation!: AdminInvitationResponseDto;
  url!: string;
  emailed!: boolean;
}
