import type { PublicConfigDto } from "@loomkeep/shared";

export class PublicConfigResponseDto implements PublicConfigDto {
  socialEnabled!: boolean;
  chatEnabled!: boolean;
  gamificationEnabled!: boolean;
  registrationEnabled!: boolean;
  publicApiEnabled!: boolean;
  erdEnabled!: boolean;
  adminMfaEnforced!: boolean;
  version!: string;
  gitSha!: string;
  supportEmail!: string;
}
