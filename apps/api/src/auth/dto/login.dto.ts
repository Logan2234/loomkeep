import type { LoginRequestDto } from "@loomkeep/shared";
import { IsString, MinLength } from "class-validator";

export class LoginDto implements LoginRequestDto {
  // Email or username — checked against both, so no format constraint here.
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  password!: string;
}
