import type { ChangeEmailRequestDto } from "@loomkeep/shared";
import { IsEmail, IsString, MinLength } from "class-validator";

export class ChangeEmailDto implements ChangeEmailRequestDto {
  @IsEmail()
  newEmail!: string;

  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
