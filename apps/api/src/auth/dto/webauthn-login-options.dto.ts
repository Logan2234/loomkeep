import type { WebauthnLoginOptionsRequestDto } from "@loomkeep/shared";
import { Transform } from "class-transformer";
import { IsString, MinLength } from "class-validator";
import { normalizeEmail } from "../../common/email.util";

export class WebauthnLoginOptionsDto implements WebauthnLoginOptionsRequestDto {
  // Email or username, lowercased like LoginDto's: both are stored lowercase.
  @Transform(({ value }) => normalizeEmail(value))
  @IsString()
  @MinLength(1)
  identifier!: string;
}
