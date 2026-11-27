import type { UserSummaryDto } from "@loomkeep/shared/contracts";
import type { ProfileAccess } from "@loomkeep/shared/enums";

export class UserSummaryResponseDto implements UserSummaryDto {
  id!: string;
  username!: string;
  displayName!: string;
  profileAccess!: ProfileAccess;
  avatarUrl!: string | null;
  anonymized?: boolean;
  xp?: number;
}
