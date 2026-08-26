import type { VerifyEmailRequestDto } from "@loomkeep/shared";
import { IsString } from "class-validator";

export class VerifyEmailDto implements VerifyEmailRequestDto {
  @IsString()
  token!: string;
}
