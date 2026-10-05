import { OTP_CODE_LENGTH } from "@loomkeep/shared";
import { IsString, Length } from "class-validator";

export class ConfirmEmailChangeDto implements ConfirmEmailChangeRequestDto {
  @IsString()
  @Length(OTP_CODE_LENGTH, OTP_CODE_LENGTH)
  code!: string;
}
