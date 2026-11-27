import type {
  AdminUserDto,
  AdminUserInvitationDto,
  AdminUserLibraryCountsDto,
  AdminUserSecondFactor,
} from "@loomkeep/shared/contracts";
import type {
  AccountDeletionReason,
  Domain,
  Plan,
  Role,
} from "@loomkeep/shared/enums";

class AdminUserInvitationResponseDto implements AdminUserInvitationDto {
  label!: string | null;
  createdByName!: string | null;
}

class AdminUserLibraryCountsResponseDto implements AdminUserLibraryCountsDto {
  media!: number;
  games!: number;
  books!: number;
  music!: number;
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
  planExpiresAt!: string | null;
  createdAt!: string;
  lastActiveAt!: string | null;
  inactivityWarningSentAt!: string | null;
  suspendedUntil!: string | null;
  deletionScheduledFor!: string | null;
  deletionReason!: AccountDeletionReason | null;
  xp!: number;
  invitation!: AdminUserInvitationResponseDto | null;
  libraryCounts!: AdminUserLibraryCountsResponseDto;
  enabledDomains!: Domain[];
  secondFactors!: AdminUserSecondFactor[];
  onboarded!: boolean;
  online!: boolean;
}
