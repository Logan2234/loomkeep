import type { ConfirmTotpRequestDto } from "@loomkeep/shared";
import { IsString, Length } from "class-validator";

export class ConfirmTotpDto implements ConfirmTotpRequestDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
