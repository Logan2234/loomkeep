import { IsString, Length } from "class-validator";
import type { ConfirmTotpRequestDto } from "@loomkeep/shared";

export class ConfirmTotpDto implements ConfirmTotpRequestDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
