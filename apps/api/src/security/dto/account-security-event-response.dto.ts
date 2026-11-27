import type { AccountSecurityEventDto } from "@loomkeep/shared/contracts";
import type { SecurityEventType } from "@loomkeep/shared/enums";

export class AccountSecurityEventResponseDto implements AccountSecurityEventDto {
  id!: string;
  type!: SecurityEventType;
  detail!: string | null;
  ip!: string | null;
  userAgent!: string | null;
  createdAt!: string;
}
