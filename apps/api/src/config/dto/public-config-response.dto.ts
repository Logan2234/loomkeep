import type { PublicConfigDto } from "@loomkeep/shared";

export class PublicConfigResponseDto implements PublicConfigDto {
  socialEnabled!: boolean;
  gamificationEnabled!: boolean;
  registrationEnabled!: boolean;
  erdEnabled!: boolean;
  adminMfaEnforced!: boolean;
  version!: string;
  gitSha!: string;
}
