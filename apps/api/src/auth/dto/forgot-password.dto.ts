import type { ForgotPasswordRequestDto } from "@loomkeep/shared";
import { IsEmail } from "class-validator";

export class ForgotPasswordDto implements ForgotPasswordRequestDto {
  @IsEmail()
  email!: string;
}
