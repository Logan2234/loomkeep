import type { SecurityEventDto, SecurityEventType } from "@loomkeep/shared";

export class SecurityEventResponseDto implements SecurityEventDto {
  id!: string;
  type!: SecurityEventType;
  userId!: string | null;
  identifier!: string | null;
  detail!: string | null;
  userAgent!: string | null;
  createdAt!: string;
}
