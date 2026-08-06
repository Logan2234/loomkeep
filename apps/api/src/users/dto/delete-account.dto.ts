import { IsString, MinLength } from "class-validator";
import type { DeleteAccountRequestDto } from "@loomkeep/shared";

export class DeleteAccountDto implements DeleteAccountRequestDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
