import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import {
  PASSWORD_DIGIT_RE,
  PASSWORD_SPECIAL_RE,
  PASSWORD_UPPERCASE_RE,
} from "@loomkeep/shared";
import type { ResetPasswordRequestDto } from "@loomkeep/shared";

export class ResetPasswordDto implements ResetPasswordRequestDto {
  @IsString()
  token!: string;

  // bcrypt truncates beyond 72 bytes, hence the upper bound.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_UPPERCASE_RE, {
    message: "newPassword must contain at least one uppercase letter",
  })
  @Matches(PASSWORD_DIGIT_RE, {
    message: "newPassword must contain at least one digit",
  })
  @Matches(PASSWORD_SPECIAL_RE, {
    message: "newPassword must contain at least one special character",
  })
  newPassword!: string;
}
