import type { ConfirmEmailChangeRequestDto } from "@loomkeep/shared";
import { IsString, Length } from "class-validator";

export class ConfirmEmailChangeDto implements ConfirmEmailChangeRequestDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
