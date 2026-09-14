import type { LoginRequestDto } from "@loomkeep/shared";
import { Transform } from "class-transformer";
import { IsString, MinLength } from "class-validator";
import { normalizeEmail } from "../../common/email.util";

export class LoginDto implements LoginRequestDto {
  // Email or username — checked against both, so no format constraint here.
  // Lowercased on the way in: emails are stored normalized (see
  // normalizeEmail) and usernames are always slugified lowercase, so this
  // makes signing in case-insensitive on both without a second lookup.
  @Transform(({ value }) => normalizeEmail(value))
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  password!: string;
}
