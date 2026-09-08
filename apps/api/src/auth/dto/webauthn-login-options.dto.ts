import type { WebauthnLoginOptionsRequestDto } from "@loomkeep/shared";
import { IsString, MinLength } from "class-validator";

export class WebauthnLoginOptionsDto implements WebauthnLoginOptionsRequestDto {
  @IsString()
  @MinLength(1)
  identifier!: string;
}
