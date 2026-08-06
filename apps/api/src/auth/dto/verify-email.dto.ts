import { IsString } from "class-validator";
import type { VerifyEmailRequestDto } from "@loomkeep/shared";

export class VerifyEmailDto implements VerifyEmailRequestDto {
  @IsString()
  token!: string;
}
