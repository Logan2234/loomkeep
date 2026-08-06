import { IsEmail, IsString, MinLength } from "class-validator";
import type { ChangeEmailRequestDto } from "@loomkeep/shared";

export class ChangeEmailDto implements ChangeEmailRequestDto {
  @IsEmail()
  newEmail!: string;

  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
