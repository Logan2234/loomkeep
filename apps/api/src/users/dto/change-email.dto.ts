import type { ChangeEmailRequestDto } from "@loomkeep/shared";
import { Transform } from "class-transformer";
import { IsEmail } from "class-validator";
import { normalizeEmail } from "../../common/email.util";

export class ChangeEmailDto implements ChangeEmailRequestDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  newEmail!: string;
}
