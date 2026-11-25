import type { PersonalInvitationDto } from "@loomkeep/shared";

export class PersonalInvitationResponseDto implements PersonalInvitationDto {
  url!: string;
  joinedCount!: number;
}
