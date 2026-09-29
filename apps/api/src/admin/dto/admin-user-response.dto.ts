import type {
  AdminUserDto,
  AdminUserInvitationDto,
  Plan,
  Role,
} from "@loomkeep/shared";

class AdminUserInvitationResponseDto implements AdminUserInvitationDto {
  label!: string | null;
  createdByName!: string | null;
}

export class AdminUserResponseDto implements AdminUserDto {
  id!: string;
  email!: string;
  username!: string;
  displayName!: string;
  avatarUrl!: string | null;
  emailVerified!: boolean;
  role!: Role;
  plan!: Plan;
  createdAt!: string;
  lastActiveAt!: string | null;
  inactivityWarningSentAt!: string | null;
  xp!: number;
  invitation!: AdminUserInvitationResponseDto | null;
}
