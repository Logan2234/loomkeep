import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { RegisterRequestDto } from "@loomkeep/shared";

export class RegisterDto implements RegisterRequestDto {
  @IsEmail()
  email!: string;

  // bcrypt truncates beyond 72 bytes, hence the upper bound.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName!: string;

  // Required only when TURNSTILE_SECRET_KEY is set — TurnstileService.verify
  // treats a missing token as a failed check in that case.
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
