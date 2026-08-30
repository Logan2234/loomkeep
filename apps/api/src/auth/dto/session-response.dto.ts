import type { SessionDto } from "@loomkeep/shared";

export class SessionResponseDto implements SessionDto {
  id!: string;
  jti!: string;
  userAgent!: string | null;
  createdAt!: string;
  lastUsedAt!: string;
}
