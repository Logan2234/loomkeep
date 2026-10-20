import type {
  AccountSecurityEventDto,
  SecurityEventType,
} from "@loomkeep/shared";

export class AccountSecurityEventResponseDto implements AccountSecurityEventDto {
  id!: string;
  type!: SecurityEventType;
  detail!: string | null;
  ip!: string | null;
  userAgent!: string | null;
  createdAt!: string;
}
