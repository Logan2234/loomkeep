import type { RemoveWebauthnCredentialRequestDto } from "@loomkeep/shared";
import { IsString, MinLength } from "class-validator";

export class RemoveWebauthnCredentialDto implements RemoveWebauthnCredentialRequestDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
