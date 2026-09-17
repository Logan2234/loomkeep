import type { RenameWebauthnCredentialRequestDto } from "@loomkeep/shared";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RenameWebauthnCredentialDto implements RenameWebauthnCredentialRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;
}
