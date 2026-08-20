import {
  Equals,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  PASSWORD_DIGIT_RE,
  PASSWORD_SPECIAL_RE,
  PASSWORD_UPPERCASE_RE,
} from "@loomkeep/shared";
import type { RegisterRequestDto } from "@loomkeep/shared";

export class RegisterDto implements RegisterRequestDto {
  @IsEmail()
  email!: string;

  // bcrypt truncates beyond 72 bytes, hence the upper bound.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_UPPERCASE_RE, {
    message: "password must contain at least one uppercase letter",
  })
  @Matches(PASSWORD_DIGIT_RE, {
    message: "password must contain at least one digit",
  })
  @Matches(PASSWORD_SPECIAL_RE, {
    message: "password must contain at least one special character",
  })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName!: string;

  @Equals(true, { message: "terms of service must be accepted" })
  acceptedTerms!: boolean;

  // Required only when TURNSTILE_SECRET_KEY is set — TurnstileService.verify
  // treats a missing token as a failed check in that case.
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
