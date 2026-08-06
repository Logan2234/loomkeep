import { IsString, MaxLength, MinLength } from "class-validator";
import type { ChangePasswordRequestDto } from "@loomkeep/shared";

export class ChangePasswordDto implements ChangePasswordRequestDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  // bcrypt truncates beyond 72 bytes, hence the upper bound.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
