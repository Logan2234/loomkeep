import type { ProfileAccess, UserSummaryDto } from "@loomkeep/shared";

export class UserSummaryResponseDto implements UserSummaryDto {
  id!: string;
  username!: string;
  displayName!: string;
  profileAccess!: ProfileAccess;
  avatarUrl!: string | null;
  anonymized?: boolean;
  streakDays?: number;
  xp?: number;
}
