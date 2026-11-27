import type { ForgotPasswordRequestDto } from "@loomkeep/shared/contracts";
import { Transform } from "class-transformer";
import { IsEmail } from "class-validator";
import { normalizeEmail } from "../../common/email.util";

export class ForgotPasswordDto implements ForgotPasswordRequestDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email!: string;
}
