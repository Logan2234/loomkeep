import {
  OTP_CODE_LENGTH,
  type ConfirmTotpRequestDto,
} from "@loomkeep/shared/contracts";
import { IsString, Length } from "class-validator";

export class ConfirmTotpDto implements ConfirmTotpRequestDto {
  @IsString()
  @Length(OTP_CODE_LENGTH, OTP_CODE_LENGTH)
  code!: string;
}
