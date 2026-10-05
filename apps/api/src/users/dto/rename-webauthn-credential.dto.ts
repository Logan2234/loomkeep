import { WEBAUTHN_NAME_MAX_LENGTH } from "@loomkeep/shared";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RenameWebauthnCredentialDto implements RenameWebauthnCredentialRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(WEBAUTHN_NAME_MAX_LENGTH)
  name!: string;
}
