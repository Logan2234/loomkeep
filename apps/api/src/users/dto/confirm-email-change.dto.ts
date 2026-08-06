import { IsString, Length } from "class-validator";
import type { ConfirmEmailChangeRequestDto } from "@loomkeep/shared";

export class ConfirmEmailChangeDto implements ConfirmEmailChangeRequestDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
