import { IsEmail } from "class-validator";
import type { ForgotPasswordRequestDto } from "@loomkeep/shared";

export class ForgotPasswordDto implements ForgotPasswordRequestDto {
  @IsEmail()
  email!: string;
}
