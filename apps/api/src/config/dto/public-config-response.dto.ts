import { type PublicConfigDto } from "@loomkeep/shared/contracts";
import { Domain } from "@loomkeep/shared/enums";
import { ApiProperty } from "@nestjs/swagger";

export class PublicConfigResponseDto implements PublicConfigDto {
  socialEnabled!: boolean;
  chatEnabled!: boolean;
  gamificationEnabled!: boolean;
  contactFormEnabled!: boolean;
  registrationEnabled!: boolean;
  publicApiEnabled!: boolean;
  askAcquisitionSource!: boolean;
  @ApiProperty({ enum: Domain, isArray: true })
  domains!: Domain[];

  erdEnabled!: boolean;
  adminMfaEnforced!: boolean;
  version!: string;
  gitSha!: string;
  supportEmail!: string;
}
