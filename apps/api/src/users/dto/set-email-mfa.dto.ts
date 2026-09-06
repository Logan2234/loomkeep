import type { SetEmailMfaRequestDto } from "@loomkeep/shared";
import { IsBoolean, IsString, MinLength, ValidateIf } from "class-validator";

export class SetEmailMfaDto implements SetEmailMfaRequestDto {
  @IsBoolean()
  enabled!: boolean;

  // Required only to disable — same reasoning as DisableTotpDto: enabling a
  // second factor never reduces account security, so only the removal needs
  // proof of identity.
  @ValidateIf((o: SetEmailMfaDto) => o.enabled === false)
  @IsString()
  @MinLength(1)
  currentPassword?: string;
}
