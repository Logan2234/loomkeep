import type { SecurityEventDto } from "@loomkeep/shared/contracts";
import type { SecurityEventType } from "@loomkeep/shared/enums";

export class SecurityEventResponseDto implements SecurityEventDto {
  id!: string;
  type!: SecurityEventType;
  userId!: string | null;
  identifier!: string | null;
  detail!: string | null;
  userAgent!: string | null;
  createdAt!: string;
}
