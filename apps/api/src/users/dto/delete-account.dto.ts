import type { DeleteAccountRequestDto } from "@loomkeep/shared";
import { IsString, MinLength } from "class-validator";

export class DeleteAccountDto implements DeleteAccountRequestDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
