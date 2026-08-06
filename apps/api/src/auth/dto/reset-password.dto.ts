import { IsString, MaxLength, MinLength } from "class-validator";
import type { ResetPasswordRequestDto } from "@loomkeep/shared";

export class ResetPasswordDto implements ResetPasswordRequestDto {
  @IsString()
  token!: string;

  // bcrypt truncates beyond 72 bytes, hence the upper bound.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
