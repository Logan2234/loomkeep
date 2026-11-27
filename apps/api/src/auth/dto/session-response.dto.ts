import type { SessionDto } from "@loomkeep/shared/contracts";

export class SessionResponseDto implements SessionDto {
  id!: string;
  jti!: string;
  isCurrent!: boolean;
  userAgent!: string | null;
  createdAt!: string;
  lastUsedAt!: string;
}
