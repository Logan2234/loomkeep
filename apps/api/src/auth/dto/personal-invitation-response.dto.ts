import type { PersonalInvitationDto } from "@loomkeep/shared/contracts";

export class PersonalInvitationResponseDto implements PersonalInvitationDto {
  url!: string;
  joinedCount!: number;
}
