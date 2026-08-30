import type { AuthTokensDto } from "@loomkeep/shared";

export class AuthTokensResponseDto implements AuthTokensDto {
  accessToken!: string;
  refreshToken!: string;
}
