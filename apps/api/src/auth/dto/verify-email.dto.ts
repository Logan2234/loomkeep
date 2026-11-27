import type { VerifyEmailRequestDto } from "@loomkeep/shared/contracts";
import { IsString } from "class-validator";

export class VerifyEmailDto implements VerifyEmailRequestDto {
  @IsString()
  token!: string;
}
