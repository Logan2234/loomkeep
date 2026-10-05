import type { ChangePasswordRequestDto } from "@loomkeep/shared";
import {
  PASSWORD_DIGIT_RE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_SPECIAL_RE,
  PASSWORD_UPPERCASE_RE,
} from "@loomkeep/shared";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto implements ChangePasswordRequestDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  // bcrypt truncates beyond 72 bytes, hence the upper bound.
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
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
