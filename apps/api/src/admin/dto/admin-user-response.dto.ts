import type { AdminUserDto, Plan, Role } from "@loomkeep/shared";

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
}
